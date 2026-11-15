import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, writeBatch, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { TimeRecord, ImportedEvent } from '../types';
import { useUsers } from '../context/UsersContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { createConfirmDialog } from '../utils/createConfirmDialog';
import { toLocalDateString } from '../utils/tools';
import { CiLoading } from '../assets/Icons';
import {
    parseLineText, matchUser, buildDay, dedupeEvents, formatMinute, LINE_FORMAT_ANNOUNCEMENT,
    type DayEvent, type DayResult, type ReviewItem,
} from '../utils/lineAttendance';


interface Row {
    key: string;
    email: string;
    label: string;
    date: string;
    day: DayResult;
    existing?: TimeRecord;
    importedEvents: DayEvent[];
    deduction: number;
    notes: string[];
    changed: boolean;
}

interface Unmatched {
    label: string;
    reason: string;
    count: number;
    sample: string;
}

interface Analysis {
    rows: Row[];
    unmatched: Unmatched[];
    review: ReviewItem[];
    messageCount: number;
    eventCount: number;
    ignoredCount: number;
}

const minuteOf = (ts: Timestamp) => {
    const d = ts.toDate();
    return d.getHours() * 60 + d.getMinutes();
};
const timestampOf = (date: string, minute: number) => Timestamp.fromDate(new Date(`${date}T${formatMinute(minute)}:00`));
const sameTime = (a: Timestamp | null | undefined, b: Timestamp | null) => (a ? a.toMillis() : null) === (b ? b.toMillis() : null);

// 暱稱 → 名冊的對應只是這台電腦的方便設定，存不了也沒關係
const ALIAS_KEY = 'lineImportAliases';
const loadAliases = (): Record<string, string> => {
    try { return JSON.parse(localStorage.getItem(ALIAS_KEY) ?? '{}') ?? {}; } catch { return {}; }
};
const saveAliases = (aliases: Record<string, string>) => {
    try { localStorage.setItem(ALIAS_KEY, JSON.stringify(aliases)); } catch { /* 忽略 */ }
};

function LineImportPage() {
    const { allUsers, loading: usersLoading, fetchUsers } = useUsers();
    const { user: adminUser } = useAuth();
    const { addToast } = useToast();

    const [text, setText] = useState('');
    const [startDate, setStartDate] = useState(() => toLocalDateString(new Date()));
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [showFormat, setShowFormat] = useState(false);
    const [aliases, setAliases] = useState<Record<string, string>>(loadAliases);

    useEffect(() => {
        document.title = '場佈打卡系統 | LINE 匯入';
        return () => { document.title = '場佈打卡系統'; };
    }, []);

    const roster = useMemo(() => allUsers.map(u => ({ email: u.email, name: u.name, classId: u.classId, seatNo: u.seatNo })), [allUsers]);
    const labelOf = useMemo(() => {
        const map = new Map(allUsers.map(u => [u.email, `${u.classId}${String(u.seatNo).padStart(2, '0')} ${u.name}`]));
        return (email: string) => map.get(email) ?? email;
    }, [allUsers]);

    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        setText(await file.text());
        setAnalysis(null);
    };

    const setAlias = (label: string, email: string) => {
        const next = { ...aliases };
        if (email) next[label] = email; else delete next[label];
        setAliases(next);
        saveAliases(next);
        analyze(next);
    };

    const analyze = async (aliasMap = aliases) => {
        if (!text.trim()) return;
        if (!roster.length) {
            addToast('使用者名冊還沒載入，請先按「更新使用者列表」。', 'error');
            return;
        }
        setBusy(true);
        try {
            const parsed = parseLineText(text, startDate);

            // 1. 對名冊
            const unmatchedMap = new Map<string, Unmatched>();
            const groups = new Map<string, { email: string; date: string; events: DayEvent[]; notes: Set<string> }>();
            const cache = new Map<string, ReturnType<typeof matchUser>>();
            for (const e of parsed.events) {
                const who = `${e.code}|${e.name}`;
                if (!cache.has(who)) cache.set(who, matchUser(e.code, e.name, roster, aliasMap));
                const match = cache.get(who)!;
                if ('error' in match) {
                    const u = unmatchedMap.get(who) ?? { label: `${e.code}${e.name}`, reason: match.error, count: 0, sample: e.source };
                    u.count++;
                    unmatchedMap.set(who, u);
                    continue;
                }
                const key = `${match.user.email}_${e.date}`;
                const g = groups.get(key) ?? { email: match.user.email, date: e.date, events: [], notes: new Set<string>() };
                g.events.push({ action: e.action, minute: e.minute, ...(e.backfill ? { explicit: true } : {}) });
                if (match.warning) g.notes.add(match.warning);
                if (e.note) g.notes.add(`${formatMinute(e.minute)} ${e.note}`);
                if (e.proxy) g.notes.add(`${formatMinute(e.minute)} 由 ${e.sender} 代簽`);
                if (e.backfill) g.notes.add(`${formatMinute(e.minute)} ${e.action === 'in' ? '簽到' : '簽退'}是補登（${e.sentAt} 傳）`);
                groups.set(key, g);
            }

            // 2. 讀出這幾天已經有的紀錄
            const dates = [...new Set([...groups.values()].map(g => g.date))];
            const existing = new Map<string, TimeRecord>();
            for (const date of dates) {
                const snap = await getDocs(query(collection(db, 'timeRecords'), where('date', '==', date)));
                snap.forEach(d => existing.set(d.id, { id: d.id, ...(d.data() as TimeRecord) }));
            }

            // 3. 合併：資料庫現有的時間 + 之前匯入過的事件 + 這次新的事件
            const rows: Row[] = [];
            for (const [key, g] of groups) {
                const ex = existing.get(key);
                const stored: DayEvent[] = (ex?.importedEvents ?? []).map(e => ({ action: e.action, minute: minuteOf(e.at), ...(e.explicit ? { explicit: true } : {}) }));
                const seen = new Set(stored.map(e => `${e.action}${e.minute}`));
                const lo = ex?.checkIn ? minuteOf(ex.checkIn) : -Infinity;
                const hi = ex?.checkOut ? minuteOf(ex.checkOut) : Infinity;
                // 之前匯入過的事件不能超出現在資料庫的簽到／簽退（可能被人手動改過）
                const known = [...stored, ...g.events.filter(e => seen.has(`${e.action}${e.minute}`))].filter(e => e.minute >= lo && e.minute <= hi);
                const fresh = g.events.filter(e => !seen.has(`${e.action}${e.minute}`));
                const base: DayEvent[] = [
                    ...(ex?.checkIn ? [{ action: 'in' as const, minute: minuteOf(ex.checkIn) }] : []),
                    ...(ex?.checkOut ? [{ action: 'out' as const, minute: minuteOf(ex.checkOut) }] : []),
                ];
                const day = buildDay([...base, ...known, ...fresh]);
                const deduction = Math.max(0, (ex?.deductionMinutes ?? 0) - (ex?.importGapMinutes ?? 0) + day.gapMinutes);
                const newIn = day.checkIn === null ? null : timestampOf(g.date, day.checkIn);
                const newOut = day.checkOut === null ? null : timestampOf(g.date, day.checkOut);
                const changed = !ex || !sameTime(ex.checkIn, newIn) || !sameTime(ex.checkOut, newOut) || (ex.deductionMinutes ?? 0) !== deduction;
                rows.push({
                    key, email: g.email, label: labelOf(g.email), date: g.date, day, existing: ex,
                    importedEvents: dedupeEvents([...stored, ...g.events]),
                    deduction, notes: [...g.notes], changed,
                });
            }
            rows.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));

            setAnalysis({
                rows,
                unmatched: [...unmatchedMap.values()],
                review: parsed.review,
                messageCount: parsed.messageCount,
                eventCount: parsed.events.length,
                ignoredCount: parsed.ignoredCount,
            });
            setSelected(new Set(rows.filter(r => r.changed && !r.day.blocking.length).map(r => r.key)));
        } catch (error: unknown) {
            console.error('解析失敗：', error);
            addToast(`解析失敗：${error instanceof Error ? error.message : String(error)}`, 'error', 10000);
        } finally {
            setBusy(false);
        }
    };

    const toggle = (key: string) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });

    const write = async () => {
        if (!analysis || !adminUser) return;
        const rows = analysis.rows.filter(r => selected.has(r.key) && !r.day.blocking.length);
        if (!rows.length) return;
        setBusy(true);
        try {
            for (let i = 0; i < rows.length; i += 400) {
                const batch = writeBatch(db);
                for (const r of rows.slice(i, i + 400)) {
                    const ex = r.existing;
                    const newIn = r.day.checkIn === null ? null : timestampOf(r.date, r.day.checkIn);
                    const newOut = r.day.checkOut === null ? null : timestampOf(r.date, r.day.checkOut);
                    const data: Record<string, unknown> = {
                        userEmail: r.email,
                        date: r.date,
                        deductionMinutes: r.deduction,
                        importGapMinutes: r.day.gapMinutes,
                        importedEvents: r.importedEvents.map((e): ImportedEvent => ({ action: e.action, at: timestampOf(r.date, e.minute), ...(e.explicit ? { explicit: true } : {}) })),
                        lastEditedByUid: adminUser.uid,
                        lastEditedAt: serverTimestamp(),
                    };
                    // 只有時間真的改變才更新紀錄者（安全規則會檢查）
                    if (!ex || !sameTime(ex.checkIn, newIn)) {
                        data.checkIn = newIn;
                        data.checkInRecorderUid = newIn ? adminUser.uid : null;
                    }
                    if (!ex || !sameTime(ex.checkOut, newOut)) {
                        data.checkOut = newOut;
                        data.checkOutRecorderUid = newOut ? adminUser.uid : null;
                    }
                    batch.set(doc(db, 'timeRecords', r.key), data, { merge: true });
                }
                await batch.commit();
            }
            addToast(`已寫入 ${rows.length} 筆紀錄！`, 'success', 5000);
            await analyze();
        } catch (error: unknown) {
            console.error('寫入失敗：', error);
            addToast(`寫入失敗：${error instanceof Error ? error.message : String(error)}`, 'error', 10000);
        } finally {
            setBusy(false);
        }
    };

    const confirmWrite = () => {
        const count = analysis?.rows.filter(r => selected.has(r.key) && !r.day.blocking.length).length ?? 0;
        if (!count) return;
        createConfirmDialog({
            title: '確認寫入？',
            message: `要把 ${count} 筆紀錄寫進資料庫，寫入後可以到個人打卡頁修改。`,
            confirmText: '寫入',
            cancelText: '取消',
            onConfirm: write,
        });
    };

    const copyFormat = async () => {
        try {
            await navigator.clipboard.writeText(LINE_FORMAT_ANNOUNCEMENT);
            addToast('已複製格式公告');
        } catch {
            addToast('複製失敗，請手動選取文字', 'error');
        }
    };

    const selectedCount = analysis?.rows.filter(r => selected.has(r.key) && !r.day.blocking.length).length ?? 0;

    return (
        <div className="space-y-4">
            <div className="bg-gray-800 p-6 rounded-lg space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <h3 className="text-xl font-bold">LINE 匯入</h3>
                        <p className="mt-1 text-sm text-gray-400">把 LINE 群組的訊息貼上，或上傳「匯出聊天記錄」的 .txt，自動找出簽到／簽退。</p>
                    </div>
                    <div className="flex gap-3 text-sm text-gray-400">
                        <button type="button" onClick={() => setShowFormat(v => !v)} className="underline underline-offset-2 cursor-pointer">
                            {showFormat ? '收起格式公告' : '格式公告'}
                        </button>
                        <button type="button" onClick={fetchUsers} disabled={usersLoading} className="underline underline-offset-2 cursor-pointer">
                            {usersLoading ? '更新中...' : '更新使用者列表'}
                        </button>
                    </div>
                </div>

                {showFormat && (
                    <div className="rounded border border-gray-600 bg-gray-900 p-4 text-sm">
                        <pre className="whitespace-pre-wrap font-sans">{LINE_FORMAT_ANNOUNCEMENT}</pre>
                        <p className="mt-3 text-gray-400">程式也看得懂：只打「簽」「退」、5.30退、5點半、20分鐘前簽、昨天、@某人 簽（代簽）、签到、謙／錢／推等錯字、在訊息裡寫學號、一則訊息同時寫簽到和簽退等寫法。暱稱不是本名的人，可以在「名冊對不到」手動對應。</p>
                        <button type="button" onClick={copyFormat} className="mt-3 px-3 py-1 border-2 border-accent-li text-accent-li rounded cursor-pointer">複製公告</button>
                    </div>
                )}

                <textarea
                    value={text}
                    onChange={e => { setText(e.target.value); setAnalysis(null); }}
                    placeholder={'17:12 10901林小華 簽退\n2026.11.11 星期三\n11:54 12101陳大文 簽到\n...'}
                    rows={10}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white font-mono text-sm"
                />
                <div className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="flex items-center gap-2">
                        <span className="text-gray-300">開頭沒有日期時用</span>
                        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setAnalysis(null); }} className="p-1 bg-gray-700 border border-gray-600 rounded text-white" />
                    </label>
                    <label className="cursor-pointer underline underline-offset-2 text-gray-300">
                        上傳 .txt
                        <input type="file" accept=".txt,text/plain" className="hidden" onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    <button
                        type="button"
                        onClick={() => analyze()}
                        disabled={busy || !text.trim()}
                        className="ml-auto px-4 py-1 border-2 border-accent-li text-accent-li font-bold rounded disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {busy ? <><CiLoading className="animate-spin text-xl inline-block" /> 處理中...</> : '解析'}
                    </button>
                </div>
            </div>

            {analysis && (
                <>
                    <div className="bg-gray-800 p-4 rounded-lg text-sm text-gray-300">
                        共 {analysis.messageCount} 則訊息，找到 {analysis.eventCount} 筆簽到／簽退，略過 {analysis.ignoredCount} 則已收回訊息。
                    </div>

                    {analysis.review.length > 0 && (
                        <div className="bg-gray-800 p-4 rounded-lg border border-yellow-600/60">
                            <h4 className="font-bold text-yellow-300">看不懂的訊息（{analysis.review.length}）</h4>
                            <p className="text-xs text-gray-400 mb-2">這些沒有匯入，請到個人打卡頁手動補，或請他們照格式重傳。</p>
                            <ul className="space-y-1 text-sm">
                                {analysis.review.map((r, i) => (
                                    <li key={i}><span className="text-yellow-300">[{r.reason}]</span> <span className="text-gray-400">{r.sentAt}</span> {r.text}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {analysis.unmatched.length > 0 && (
                        <div className="bg-gray-800 p-4 rounded-lg border border-red-600/60">
                            <h4 className="font-bold text-red-300">名冊對不到（{analysis.unmatched.length}）</h4>
                            <p className="text-xs text-gray-400">暱稱不是本名的，選擇他是誰就會重新解析（這台電腦會記住）。</p>
                            <ul className="space-y-2 text-sm mt-2">
                                {analysis.unmatched.map(u => (
                                    <li key={u.label} className="flex flex-wrap items-center gap-2">
                                        <span><span className="text-red-300">{u.reason}</span>（{u.count} 筆）<span className="text-gray-400">例：{u.sample}</span></span>
                                        <select
                                            value=""
                                            disabled={busy}
                                            onChange={e => setAlias(u.label, e.target.value)}
                                            className="p-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                                        >
                                            <option value="">對應到…</option>
                                            {[...allUsers].sort((a, b) => labelOf(a.email).localeCompare(labelOf(b.email))).map(x => (
                                                <option key={x.email} value={x.email}>{labelOf(x.email)}</option>
                                            ))}
                                        </select>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {Object.keys(aliases).length > 0 && (
                        <div className="bg-gray-800 p-4 rounded-lg text-sm">
                            <h4 className="font-bold">手動對應的暱稱</h4>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {Object.entries(aliases).map(([label, email]) => (
                                    <button
                                        key={label}
                                        type="button"
                                        disabled={busy}
                                        onClick={() => setAlias(label, '')}
                                        className="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 cursor-pointer"
                                        title="取消這個對應"
                                    >
                                        {label} → {labelOf(email)} ✕
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-gray-800 p-4 rounded-lg">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <h4 className="font-bold">預覽（{analysis.rows.length} 筆，已勾選 {selectedCount} 筆）</h4>
                            <button
                                type="button"
                                onClick={confirmWrite}
                                disabled={busy || !selectedCount}
                                className="px-4 py-1 border-2 border-accent-li text-accent-li font-bold rounded disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                寫入 {selectedCount} 筆
                            </button>
                        </div>
                        <div className="overflow-x-auto max-h-[65vh] bg-gray-900 rounded">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-700 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-2 px-3"></th>
                                        <th className="p-2 px-3">日期</th>
                                        <th className="p-2 px-3">成員</th>
                                        <th className="p-2 px-3">時段</th>
                                        <th className="p-2 px-3">簽到 → 簽退</th>
                                        <th className="p-2 px-3">扣時</th>
                                        <th className="p-2 px-3">提醒</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analysis.rows.map(r => {
                                        const blocked = r.day.blocking.length > 0;
                                        const exIn = r.existing?.checkIn ? formatMinute(minuteOf(r.existing.checkIn)) : '-';
                                        const exOut = r.existing?.checkOut ? formatMinute(minuteOf(r.existing.checkOut)) : '-';
                                        return (
                                            <tr key={r.key} className={`not-last:border-b border-gray-700 align-top ${blocked ? 'bg-red-900/20' : !r.changed ? 'opacity-50' : ''}`}>
                                                <td className="p-2 px-3">
                                                    <input type="checkbox" checked={selected.has(r.key) && !blocked} disabled={blocked} onChange={() => toggle(r.key)} />
                                                </td>
                                                <td className="p-2 px-3 font-mono whitespace-nowrap">{r.date.slice(5)}</td>
                                                <td className="p-2 px-3 whitespace-nowrap">
                                                    <Link to={`/admin/record/${r.email}?date=${r.date}`} className="hover:text-accent-li">{r.label}</Link>
                                                </td>
                                                <td className="p-2 px-3 font-mono text-xs">{r.day.sessions.map(([a, b]) => `${formatMinute(a)}–${b === null ? '?' : formatMinute(b)}`).join(', ')}</td>
                                                <td className="p-2 px-3 font-mono whitespace-nowrap">
                                                    {formatMinute(r.day.checkIn)} → {r.day.checkOut === null ? '未簽退' : formatMinute(r.day.checkOut)}
                                                    {r.existing && <div className="text-xs text-gray-500">原本 {exIn} → {exOut}</div>}
                                                </td>
                                                <td className="p-2 px-3 font-mono">{r.deduction}</td>
                                                <td className="p-2 px-3 text-xs space-y-0.5">
                                                    {!r.changed && <div className="text-gray-400">和資料庫一樣，不用寫入</div>}
                                                    {r.day.blocking.map(m => <div key={m} className="text-red-300">✕ {m}</div>)}
                                                    {r.day.warnings.map(m => <div key={m} className="text-yellow-300">! {m}</div>)}
                                                    {r.notes.map(m => <div key={m} className="text-gray-400">{m}</div>)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {!analysis.rows.length && (
                                        <tr><td colSpan={7} className="text-center p-8 text-gray-500">沒有找到可以匯入的簽到／簽退</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
            <div className='w-full h-4 bg-transparent'></div>
        </div>
    );
}

export default LineImportPage;
