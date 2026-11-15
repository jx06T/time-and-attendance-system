export type Action = 'in' | 'out';

// 貼到群組的格式公告（程式實際上看得懂的寫法比這個多）
export const LINE_FORMAT_ANNOUNCEMENT = `【場佈簽到格式】
簽到：簽到
簽退：簽退
補簽（24 小時制）：17:30簽退
不是當天補的要寫日期：11/14 17:30補簽退
代簽：簽到（11001王小明）
`;

export interface ParsedEvent {
    code: string;      // 訊息裡的學號（可能不完整，例如只有班級 109）
    name: string;      // 訊息裡的姓名（可能是空的）
    proxy: boolean;    // 是不是別人代簽
    sender: string;    // 發訊者的「學號姓名」
    date: string;      // YYYY-MM-DD
    minute: number;    // 當天第幾分鐘
    action: Action;
    backfill: boolean; // 訊息裡有寫時間或日期（補登）
    sentAt: string;    // 發訊時間 YYYY-MM-DD HH:mm
    source: string;    // 原始訊息
    note?: string;     // 例如「錢」當作簽到
}

export interface ReviewItem {
    reason: string;
    text: string;
    sentAt: string;
}

export interface ParseResult {
    events: ParsedEvent[];
    review: ReviewItem[];
    messageCount: number;
    ignoredCount: number;
}

const pad = (n: number | string) => String(n).padStart(2, '0');
const toMin = (h: number, m: number) => h * 60 + m;

export const formatMinute = (min: number | null): string =>
    min === null ? '?' : `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

export const addDays = (date: string, days: number): string => {
    const t = new Date(`${date}T00:00:00`);
    t.setDate(t.getDate() + days);
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
};

// 「2026.11.11 星期三」「2026/11/11（三）」「2026-11-11」
const DATE_LINE = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:\s*[(（]?\s*(?:星期|週|周)?[一二三四五六日天][)）]?)?\s*$/;
// 「17:12 10901林小華 簽退」「下午5:12 ...」（LINE 匯出的 .txt 是用 tab 分隔）
const MSG_LINE = /^(?:(上午|下午)\s*)?(\d{1,2}):(\d{2})\s+(.*)$/;
// 發訊者：學號（中間可能有空格）＋ 姓名，後面接訊息
const SENDER = /^(\d[\d ]{2,6}?)\s*([^\s\d@]{2,5}?)(?:\s+(.*))?$/;
// 系統訊息：「王小明加入聊天」「王小明已收回訊息」（名字和動作中間沒有空白）
const IGNORED_MESSAGE = /已收回訊息$|^\S+?(?:加入|離開|退出)(?:聊天|群組|社群)?\S*$|^\S+\s*已將.*(?:加入|移除)/;
// 一個字的錯字／注音：「謙」「錢」→ 簽，「推」「ㄊㄨㄟ」→ 退
const TYPO_IN = /^(?:謙|錢|千|ㄑㄧㄢ[ˉˊˇˋ˙]?)$/;
const TYPO_OUT = /^(?:推|腿|ㄊㄨㄟ[ˉˊˇˋ˙]?)$/;

const CN_DIGIT: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function cnNumber(s: string): number {
    if (/^\d+$/.test(s)) return Number(s);
    if (!/^[零〇一二兩三四五六七八九十]+$/.test(s)) return NaN;
    if (!s.includes('十')) return s.length === 1 ? CN_DIGIT[s] : NaN;
    const [tens, ones] = s.split('十');
    return (tens ? CN_DIGIT[tens] : 1) * 10 + (ones ? CN_DIGIT[ones] : 0);
}

const NUM = '(?:\\d{1,2}|[零〇一二兩三四五六七八九十]{1,3})';
// 姓名：2–4 個中文字，但不能把「簽到」「下午」這類關鍵字吃進去
const NAME = '(?:(?!簽|補|昨|前天|今天|今日|早上|上午|中午|下午|晚上|點|半|和|跟|我|幫|代)[\\u4e00-\\u9fff]){2,4}';
// 簽到、簽退、補簽，也接受只打「簽」（= 簽到）、「退」、「離開」，以及有寫時間的「走」
const ACTION = /已?(補)?\s*簽\s*(到|退)?了?|(退)|(離開|走)/;
const ACTION_G = /已?補?\s*簽\s*[到退]?了?|退|離開|走/g;
const KEYWORD = /簽|退|離開|走/;
// 「忘了簽」「忘記請人代簽了」是在講之前的事，不是動作
const CHATTER = /忘[^簽退]{0,6}簽\s*[到退]?了?|(?:請人)?代簽了?(?!\s*[到退])/g;
const FILLER = /[#@,、，;；:.\-\s]|我|了|已|的|一下|有|在|補|幫|代|和|跟|喔|哦|囉|啦|唷|嗎|剛剛|剛才|剛|中途|先/g;

export function normalize(s: string): string {
    return s
        .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)) // 全形 → 半形
        .replace(/\u3000/g, ' ')
        .replace(/[签籤]/g, '簽') // 簡體字、常見錯字
        .replace(/\p{Extended_Pictographic}|️/gu, ' ')
        .replace(/[!?~～。…]+/g, ' ')
        .trim();
}

interface Person { code: string; name: string }

function parsePerson(s: string): Person | null {
    const m = s.trim().match(new RegExp(`^(?:(\\d{3})\\s?(\\d{2})?)?\\s*(${NAME})?$`));
    if (!m || (!m[1] && !m[3])) return null;
    return { code: (m[1] ?? '') + (m[2] ?? ''), name: m[3] ?? '' };
}

interface Segment {
    action: Action | null;
    agoMinutes: number | null; // 「20分鐘前」
    day: number | null;
    monthDay: [number, number] | null;
    hour: number | null;
    minute: number;
    period: string | null;
    people: Person[];
    withSelf: boolean;
    unclear: boolean;
}

// 從一段文字拿出：動作、日期、時間、對象。剩下的字如果不是贅字，就當作看不懂。
function parseSegment(text: string, senderName: string): Segment {
    let t = ` ${text} `;
    const take = (re: RegExp, fn: (m: (string | undefined)[]) => void) => {
        t = t.replace(re, (...m: (string | undefined)[]) => { fn(m); return ' '; });
    };
    const r: Segment = { action: null, agoMinutes: null, day: null, monthDay: null, hour: null, minute: 0, period: null, people: [], withSelf: false, unclear: false };

    let weak = false; // 「走」只有寫了時間才算
    take(ACTION, m => {
        r.action = m[2] === '退' || m[3] || m[4] ? 'out' : 'in';
        weak = m[4] === '走';
    });
    take(/我(?:和|跟)|(?:和|跟)我/g, () => { r.withSelf = true; });
    take(/我(?!\s*(?:幫|代))/g, () => { r.withSelf = true; });

    // @提及：「@王小明 @建班廖浥玹 簽」是幫他們簽
    take(/@\s*([^\s@]+)/g, m => {
        const raw = m[1] ?? '';
        r.people.push(parsePerson(raw) ?? { code: '', name: raw });
    });

    // 對象：括號裡、「幫／代」後面、或學號（＋姓名）
    take(/\(([^)]*)\)/g, m => {
        for (const part of (m[1] ?? '').split(/[,、，]|\s+(?=\d{3})/)) {
            if (!part.trim()) continue;
            const p = parsePerson(part);
            if (p) r.people.push(p); else r.unclear = true;
        }
    });
    take(new RegExp(`(?:幫|代)\\s*((?:\\d{3}\\s?\\d{0,2})?\\s*${NAME})`, 'g'), m => {
        const p = parsePerson(m[1] ?? '');
        if (p) r.people.push(p); else r.unclear = true;
    });
    take(new RegExp(`(?<![\\d:./])(\\d{3})(?:\\s?(\\d{2}))?(?![\\d:./月點点時])\\s*(${NAME})?`, 'g'), m => {
        r.people.push({ code: (m[1] ?? '') + (m[2] ?? ''), name: m[3] ?? '' });
    });

    // 日期
    take(/昨天|昨日/, () => { r.day = -1; });
    take(/前天/, () => { r.day = -2; });
    take(/今天|今日/, () => { r.day = 0; });
    take(/(?<!\d)(\d{1,2})\s*(?:\/|月)\s*(\d{1,2})\s*[日號号]?/, m => { r.monthDay = [Number(m[1]), Number(m[2])]; });

    // 相對時間：20分鐘前、半小時前、1小時前
    take(new RegExp(`(半|${NUM})\\s*個?\\s*(分鐘?|分钟|小時|小时|鐘頭)\\s*前`), m => {
        const n = m[1] === '半' ? 0.5 : cnNumber(m[1] ?? '');
        r.agoMinutes = Math.round(m[2]?.startsWith('分') ? n : n * 60);
    });

    // 時間：17:30、5.30、5：30、5點半、五點半、9.（只有小時）
    take(/早上|上午|中午|下午|晚上/, m => { r.period = m[0] ?? null; });
    take(new RegExp(`(?<!\\d)(\\d{1,2})\\s*[:.]\\s*(\\d{2})(?!\\d)|(${NUM})\\s*[點点時]\\s*(半|${NUM})?\\s*分?|(?<![\\d.])(\\d{1,2})\\s*\\.(?!\\s*\\d)`), m => {
        if (m[1] !== undefined) { r.hour = Number(m[1]); r.minute = Number(m[2]); }
        else if (m[3] !== undefined) { r.hour = cnNumber(m[3]); r.minute = m[4] === '半' ? 30 : m[4] ? cnNumber(m[4]) : 0; }
        else { r.hour = Number(m[5]); }
    });

    t = t.split(senderName).join(' ');
    if (weak && r.hour === null && r.agoMinutes === null) return { ...r, action: null }; // 「走了嗎」之類的聊天
    if (t.replace(FILLER, '')) r.unclear = true;
    return r;
}

// 一行裡可能有好幾個動作：「12:20簽到 13:00簽退」或「簽到 12:20 簽退 13:00」
function splitCommands(line: string): string[] {
    const spans = [...line.matchAll(ACTION_G)].map(m => [m.index ?? 0, (m.index ?? 0) + m[0].length]);
    if (spans.length <= 1) return [line];
    const timeFirst = /\d\s*[:.點点]|[點点]/.test(line.slice(0, spans[0][0]));
    const out: string[] = [];
    if (timeFirst) {
        let start = 0;
        spans.forEach(([, end], i) => { out.push(line.slice(start, i === spans.length - 1 ? line.length : end)); start = end; });
    } else {
        spans.forEach(([begin], i) => out.push(line.slice(i === 0 ? 0 : begin, i + 1 < spans.length ? spans[i + 1][0] : line.length)));
    }
    return out;
}

interface Message { date: string; minute: number; head: string; lines: string[] }

function splitMessages(text: string, startDate: string): Message[] {
    const messages: Message[] = [];
    let date = startDate;
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        const d = line.replace(/\t/g, ' ').match(DATE_LINE);
        if (d) { date = `${d[1]}-${pad(d[2])}-${pad(d[3])}`; continue; }
        const m = line.match(MSG_LINE);
        // 「17:30 簽退」是上一則訊息的補登，不是新訊息
        const continuation = m && messages.length && /^(?:已?補?簽[到退]?了?|退)(?:\s|$)/.test(m[4]);
        if (m && !continuation) {
            let h = Number(m[2]);
            if (m[1] === '下午' && h < 12) h += 12;
            if (m[1] === '上午' && h === 12) h = 0;
            messages.push({ date, minute: toMin(h, Number(m[3])), head: m[4], lines: [] });
            continue;
        }
        if (line && messages.length) messages[messages.length - 1].lines.push(line.replace(/\t/g, ' ')); // 多行訊息
    }
    return messages;
}

type Resolved = { error: string } | { events: Omit<ParsedEvent, 'source'>[] };

function resolveSegment(seg: Segment, msg: Message, code: string, name: string): Resolved {
    let date = msg.date;
    if (seg.day !== null) date = addDays(msg.date, seg.day);
    if (seg.monthDay) {
        const year = Number(msg.date.slice(0, 4));
        const [mo, d] = seg.monthDay;
        if (mo < 1 || mo > 12 || d < 1 || d > 31) return { error: '日期不合理' };
        date = `${year}-${pad(mo)}-${pad(d)}`;
        if (date > msg.date) date = `${year - 1}-${pad(mo)}-${pad(d)}`;
    }
    const sameDay = date === msg.date;
    let minute = msg.minute;
    let backfill = !sameDay;

    if (seg.hour !== null) {
        backfill = true;
        const h = seg.hour, mi = seg.minute;
        if (!(h >= 0 && h <= 23 && mi >= 0 && mi < 60)) return { error: '時間不合理' };
        let hours: number[];
        if (seg.period === '下午' || seg.period === '晚上') hours = [h < 12 ? h + 12 : h];
        else if (seg.period === '中午') hours = [h <= 2 ? h + 12 : h];
        else if (seg.period) hours = [h === 12 ? 0 : h];
        else hours = h < 12 ? [h, h + 12] : [h]; // 「5:30」可能是早上或下午
        // 取不晚於發訊時間的最晚那個（別天的補登就不限制）
        const candidates = hours.map(x => toMin(x, mi)).filter(x => x < 1440 && (!sameDay || x <= msg.minute));
        if (!candidates.length) return { error: '補登的時間比發訊時間還晚' };
        minute = Math.max(...candidates);
    } else if (seg.agoMinutes !== null && sameDay) {
        backfill = true;
        minute = msg.minute - seg.agoMinutes;
        if (minute < 0) return { error: '補登的時間跨到前一天' };
    } else if (!sameDay) {
        return { error: '補登別天但沒有寫時間' };
    }

    const isSelf = (p: Person) => (p.name ? p.name === name : code.startsWith(p.code));
    const others = seg.people.filter(p => !isSelf(p));
    const includeSelf = seg.withSelf || seg.people.length === 0 || seg.people.some(isSelf);
    const people = [
        ...(includeSelf ? [{ code, name, proxy: false }] : []),
        ...others.map(p => ({ ...p, proxy: true })),
    ];
    return {
        events: people.map(p => ({
            ...p,
            sender: `${code}${name}`,
            date,
            minute,
            action: seg.action as Action,
            backfill,
            sentAt: `${msg.date} ${formatMinute(msg.minute)}`,
        })),
    };
}

// 發訊者：LINE 匯出的 .txt 用 tab 分隔；貼上的文字用空白，暱稱可能是「學號姓名」或只有姓名／暱稱
function parseSender(head: string): { code: string; name: string; rest: string } | null {
    const s = head.match(SENDER);
    if (s) return { code: s[1].replace(/\s/g, ''), name: s[2], rest: s[3] ?? '' };
    const parts = head.includes('\t') ? head.split('\t') : head.split(/\s+/);
    const name = parts[0].trim();
    if (!name) return null;
    return { code: '', name, rest: parts.slice(1).join(' ') };
}

/**
 * 解析 LINE 聊天文字。
 * @param startDate 文字開頭還沒出現日期列時，用這一天
 */
export function parseLineText(text: string, startDate: string): ParseResult {
    const messages = splitMessages(text, startDate);
    const events: ParsedEvent[] = [];
    const review: ReviewItem[] = [];
    let ignoredCount = 0;

    for (const msg of messages) {
        const sentAt = `${msg.date} ${formatMinute(msg.minute)}`;
        if (IGNORED_MESSAGE.test(msg.head)) { ignoredCount++; continue; }
        const allText = [msg.head, ...msg.lines].join(' ／ ').replace(/\t/g, ' ');
        const sender = parseSender(msg.head);
        if (!sender) {
            if (KEYWORD.test(normalize(allText))) review.push({ reason: '看不出是誰傳的', text: allText, sentAt });
            continue;
        }
        const { code, name } = sender;
        const lines = [sender.rest, ...msg.lines].map(normalize).filter(Boolean);

        const found: ParsedEvent[] = [];
        const errors: string[] = [];
        let unclear = false;
        let pending = ''; // 「@王小明 @李大華 我」換行再「簽到」
        for (let line of lines) {
            let note: string | undefined;
            if (TYPO_IN.test(line)) { note = `「${line}」當作簽到`; line = '簽'; }
            else if (TYPO_OUT.test(line)) { note = `「${line}」當作簽退`; line = '退'; }
            const stripped = line.replace(CHATTER, ' ').trim();
            // 拿掉之後還有動作就用拿掉的（「退剛忘了簽」）；只剩「忘記簽到」就整句交給人看
            if (KEYWORD.test(stripped) || !/簽\s*[到退]/.test(line)) line = stripped;
            if (!KEYWORD.test(line)) {
                if (/^(?:(?:@\s*[^\s@]+|我)\s*)+$/.test(line)) pending += `${line} `;
                continue;
            }
            line = pending + line;
            pending = '';
            const segs = splitCommands(line).map(part => parseSegment(part, name)).filter(seg => seg.action);
            // 一行裡只要有一段看不懂，整行都不採用（例如「退打退」）
            if (segs.some(seg => seg.unclear)) { unclear = true; continue; }
            for (const seg of segs) {
                const res = resolveSegment(seg, msg, code, name);
                if ('error' in res) { errors.push(res.error); continue; }
                found.push(...res.events.map(e => ({ ...e, source: allText, ...(note ? { note } : {}) })));
            }
        }
        events.push(...found);
        for (const reason of errors) review.push({ reason, text: allText, sentAt });
        // 同一則訊息裡已經有看得懂的簽到／簽退，其他行（例如「啊忘記簽到」）就當聊天
        if (!found.length && !errors.length && unclear) review.push({ reason: '有提到簽到／簽退，但格式看不懂', text: allText, sentAt });
    }
    return { events, review, messageCount: messages.length, ignoredCount };
}

// ---------- 對名冊 ----------

export interface RosterUser { email: string; name: string; classId: string; seatNo: string }

export type MatchResult =
    | { user: RosterUser; warning?: string }
    | { error: string };

const rosterCode = (u: RosterUser) => `${String(u.classId).trim()}${String(u.seatNo).trim().padStart(2, '0')}`;

/** @param aliases 管理員手動指定的對應：「學號姓名」或暱稱 → email */
export function matchUser(code: string, name: string, roster: RosterUser[], aliases: Record<string, string> = {}): MatchResult {
    const aliased = aliases[`${code}${name}`];
    if (aliased) {
        const u = roster.find(x => x.email === aliased);
        if (u) return { user: u, warning: `「${code}${name}」手動對應到 ${u.name}` };
    }
    const byCode = code.length >= 5 ? roster.filter(u => rosterCode(u) === code) : [];
    const byName = name ? roster.filter(u => u.name.trim() === name) : [];
    const label = `${code}${name}`;

    if (byCode.length === 1) {
        const u = byCode[0];
        if (!name || u.name.trim() === name) return { user: u };
        if (byName.length >= 1) return { error: `${label}：學號是 ${u.name}，姓名卻是另一位同學` };
        return { user: u, warning: `姓名不符（名冊是 ${u.name}）` };
    }
    if (byCode.length > 1) return { error: `${label}：名冊裡有多人是這個學號` };

    if (byName.length) {
        const sameClass = code ? byName.filter(u => rosterCode(u).startsWith(code.slice(0, 3))) : byName;
        const candidates = sameClass.length ? sameClass : byName;
        if (candidates.length === 1) {
            const u = candidates[0];
            // 暱稱只有姓名（沒有學號）且名冊只有一位同名的，不用特別提醒
            const warning = !code ? undefined : code.length < 5 ? '學號不完整，用姓名對到' : `學號不符（名冊是 ${rosterCode(u)}）`;
            return { user: u, warning };
        }
        return { error: `${label}：名冊裡有同名的人，請手動處理` };
    }
    // 暱稱裡有名冊上的姓名，例如「建班廖浥玹」
    if (!code && name) {
        const inside = roster.filter(u => u.name.trim().length >= 2 && name.includes(u.name.trim()));
        if (inside.length === 1) return { user: inside[0], warning: `暱稱「${name}」對到 ${inside[0].name}` };
    }
    return { error: `${label}：名冊裡找不到這個人` };
}

// ---------- 一個人一天的紀錄 ----------

export interface DayEvent { action: Action; minute: number; explicit?: boolean } // explicit：訊息裡有寫時間

export interface DayResult {
    sessions: [number | null, number | null][];
    checkIn: number | null;
    checkOut: number | null;
    gapMinutes: number; // 各段中間的空檔（寫進扣時）
    warnings: string[];
    blocking: string[];   // 有這些問題就不能寫入
}

export function dedupeEvents(events: DayEvent[]): DayEvent[] {
    const map = new Map<string, DayEvent>();
    for (const e of events) {
        const k = `${e.action}${e.minute}`;
        const prev = map.get(k);
        map.set(k, { action: e.action, minute: e.minute, ...(prev?.explicit || e.explicit ? { explicit: true } : {}) });
    }
    return [...map.values()].sort((a, b) => a.minute - b.minute || (a.action === 'in' ? -1 : 1));
}

/** 同一人同一天可能有好幾段：簽到取最早、簽退取最晚，中間的空檔另外算。 */
export function buildDay(events: DayEvent[]): DayResult {
    const sorted = dedupeEvents(events);
    const sessions: [number | null, number | null][] = [];
    const warnings: string[] = [];
    const blocking: string[] = [];
    let open: number | null = null;
    let openExplicit = false;
    let lastOutExplicit = false;

    for (const e of sorted) {
        if (e.action === 'in') {
            if (open === null) { open = e.minute; openExplicit = !!e.explicit; }
            else if (e.explicit && !openExplicit && e.minute - open <= 60) {
                warnings.push(`${formatMinute(open)} 簽到後又補登 ${formatMinute(e.minute)} 簽到，採用補登的時間`);
                open = e.minute;
                openExplicit = true;
            } else warnings.push(`${formatMinute(open)} 簽到後沒有簽退又在 ${formatMinute(e.minute)} 簽到，採用較早的`);
        } else if (open !== null) {
            sessions.push([open, e.minute]);
            open = null;
            lastOutExplicit = !!e.explicit;
        } else if (sessions.length && sessions[sessions.length - 1][1] !== null) {
            // 連續兩次簽退：有寫時間的（補登）優先，否則採用較晚的
            const last = sessions[sessions.length - 1];
            if (lastOutExplicit && !e.explicit) {
                warnings.push(`${formatMinute(e.minute)} 的簽退和補登的 ${formatMinute(last[1])} 重複，採用補登的時間`);
            } else {
                warnings.push(e.explicit && !lastOutExplicit
                    ? `${formatMinute(last[1])} 簽退後又補登 ${formatMinute(e.minute)} 簽退，採用補登的時間`
                    : `${formatMinute(last[1])} 之後又在 ${formatMinute(e.minute)} 簽退，採用較晚的`);
                last[1] = e.minute;
                lastOutExplicit = !!e.explicit;
            }
        } else {
            sessions.push([null, e.minute]);
            lastOutExplicit = !!e.explicit;
        }
    }
    if (open !== null) sessions.push([open, null]);

    let gapMinutes = 0;
    for (let i = 1; i < sessions.length; i++) {
        const prevEnd = sessions[i - 1][1];
        const start = sessions[i][0];
        if (prevEnd !== null && start !== null) gapMinutes += start - prevEnd;
    }
    const checkIn = sessions.length ? sessions[0][0] : null;
    const checkOut = sessions.length ? sessions[sessions.length - 1][1] : null;
    if (sessions.length && checkIn === null) blocking.push('只有簽退，找不到簽到');
    if (checkOut === null && checkIn !== null) warnings.push('還沒簽退（會先記成未簽退）');
    for (const [a, b] of sessions) {
        if (a !== null && b !== null && b - a < 5) warnings.push(`${formatMinute(a)}–${formatMinute(b)} 不到 5 分鐘`);
    }
    return { sessions, checkIn, checkOut, gapMinutes, warnings, blocking };
}
