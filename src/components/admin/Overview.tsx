import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';

import { db } from '../../firebase';
import { useUsers } from '../../context/UsersContext';
import type { TimeRecord } from '../../types';
import { toLocalDateString } from '../../utils/tools';
import { calculateOverviewStats } from '../../utils/overviewStats';
import type { GroupOverview } from '../../utils/overviewStats';

const hourFormat = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 1 });

function percentText(value: number | null) {
  if (value === null) return '—';
  return `${value > 0 ? '+' : ''}${percentFormat.format(value)}%`;
}

function percentColor(value: number | null) {
  if (value === null) return 'text-gray-400';
  if (value > 0) return 'text-emerald-300';
  if (value < 0) return 'text-amber-300';
  return 'text-gray-200';
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg bg-gray-900/45 p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-neutral">{value}</p>
      {detail && <p className="mt-1 text-xs text-gray-400">{detail}</p>}
    </div>
  );
}

function GroupPanel({ title, subtitle, stats, accent }: {
  title: string;
  subtitle: string;
  stats: GroupOverview;
  accent: string;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-gray-800/90 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className={`text-xl font-bold ${accent}`}>{title}</h3>
          <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
        </div>
        <p className="text-sm text-gray-300">出席 <strong className="text-lg text-neutral">{stats.attendeeCount}/{stats.rosterCount}</strong></p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric label="本週總工時" value={`${hourFormat.format(stats.totalHours)} h`} detail="已簽退淨工時" />
        <Metric label="人均週工時" value={`${hourFormat.format(stats.averageWeeklyHours)} h`} detail="總工時 ÷ 到場人數" />
        <Metric label="平均日工時" value={`${hourFormat.format(stats.averageDailyHours)} h`} detail="總工時 ÷ 已簽退人日" />
        <Metric label="平均到場日" value={`${hourFormat.format(stats.averageAttendanceDays)} 日`} detail="到場人日 ÷ 到場人數" />
      </div>
      <p className="mt-4 text-xs text-gray-400">未到場 {stats.absentCount} 人 · 到場 {stats.attendanceDays} 人日{stats.pendingRecordCount > 0 ? ` · 未簽退 ${stats.pendingRecordCount} 筆` : ''}</p>
    </section>
  );
}

function Overview() {
  const { allUsers, loading: usersLoading, fetchUsers } = useUsers();
  const [todayDate, setTodayDate] = useState(() => toLocalDateString(new Date()));
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setTodayDate(toLocalDateString(new Date())), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const fetchRecords = async () => {
      setRecordsLoading(true);
      setRecordsError('');
      const currentMonday = new Date(`${todayDate}T12:00:00`);
      const weekday = currentMonday.getDay();
      currentMonday.setDate(currentMonday.getDate() - (weekday === 0 ? 6 : weekday - 1) - 2 * 7);
      try {
        const snapshot = await getDocs(query(
          collection(db, 'timeRecords'),
          where('date', '>=', toLocalDateString(currentMonday)),
          where('date', '<=', todayDate),
        ));
        if (active) setRecords(snapshot.docs.map(document => ({ id: document.id, ...document.data() } as TimeRecord)));
      } catch (error) {
        if (active) setRecordsError(error instanceof Error ? error.message : String(error));
      } finally {
        if (active) setRecordsLoading(false);
      }
    };
    void fetchRecords();
    return () => { active = false; };
  }, [todayDate]);

  const stats = useMemo(() => calculateOverviewStats(allUsers, records, todayDate), [allUsers, records, todayDate]);
  const loading = usersLoading || recordsLoading;
  const otherGroup = stats.groups.other;

  return (
    <div className="space-y-6 pb-28">
      <section className="overflow-hidden rounded-2xl border border-accent-li/30 bg-gradient-to-br from-accent/70 via-gray-800 to-brand p-6 sm:p-8">
        <p className="text-sm font-semibold tracking-[0.2em] text-accent-li">TEAM OVERVIEW</p>
        <h2 className="mt-2 text-3xl font-bold">本週總預覽</h2>
        <p className="mt-2 text-sm text-gray-200">{stats.weekStart} 至 {todayDate} · 以目前使用者名冊計算</p>
        {!loading && !recordsError && <p className="mt-5 text-4xl font-bold text-neutral">{hourFormat.format(stats.totalHours)} <span className="text-2xl">h</span><span className="ml-3 text-sm font-normal text-gray-300">本週已完成淨工時</span></p>}
      </section>

      {recordsError && (
        <div role="alert" className="rounded-xl border border-red-500/50 bg-red-950/50 p-4 text-red-200">
          讀取打卡紀錄失敗：{recordsError}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl bg-gray-800 p-10 text-center text-gray-300">正在整理本週資料...</div>
      ) : recordsError ? null : (
        <>
          {stats.groups.junior.rosterCount + stats.groups.senior.rosterCount + otherGroup.rosterCount === 0 && (
            <div className="rounded-xl border border-gray-600 bg-gray-800 p-4 text-sm text-gray-200">
              目前沒有使用者名冊。<button type="button" onClick={() => void fetchUsers()} className="ml-2 font-semibold text-accent-li underline">重新載入名冊</button>
            </div>
          )}

          <section aria-label="學長與學弟本週指標" className="grid gap-4 lg:grid-cols-2">
            <GroupPanel title="學弟" subtitle="班級首碼 1" stats={stats.groups.junior} accent="text-sky-300" />
            <GroupPanel title="學長" subtitle="班級首碼 2、3" stats={stats.groups.senior} accent="text-accent-li" />
          </section>

          {otherGroup.rosterCount > 0 && (
            <p className="rounded-lg border border-white/10 bg-gray-800/70 p-4 text-sm text-gray-300">
              其他班級：出席 {otherGroup.attendeeCount}/{otherGroup.rosterCount}，本週 {hourFormat.format(otherGroup.totalHours)} h；已計入全體統計。
            </p>
          )}

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-gray-800/90 p-5">
              <h3 className="text-lg font-bold">與上週同日比較</h3>
              <p className="mt-1 text-xs text-gray-400">本週截至 {todayDate.slice(5)}，對照上週截至 {stats.lastWeekSameDay.slice(5)}</p>
              <p className={`mt-4 text-3xl font-bold ${percentColor(stats.sameDayChangePercent)}`}>{percentText(stats.sameDayChangePercent)}</p>
              <p className="mt-2 text-sm text-gray-300">本週 {hourFormat.format(stats.totalHours)} h · 上週同日 {hourFormat.format(stats.lastWeekToDateHours)} h</p>
              {stats.sameDayChangePercent === null && <p className="mt-2 text-xs text-gray-400">上週同日工時為 0，無法計算百分比。</p>}
              <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-sm">
                <p className="text-xs text-gray-400">分組工時：本週／上週同日</p>
                {(['junior', 'senior'] as const).map(group => (
                  <div key={group} className="flex justify-between gap-2">
                    <span className="text-gray-300">{group === 'junior' ? '學弟' : '學長'} <span className="text-xs text-gray-400">{hourFormat.format(stats.groups[group].totalHours)} / {hourFormat.format(stats.lastWeekToDateHoursByGroup[group])} h</span></span>
                    <span className={percentColor(stats.sameDayChangePercentByGroup[group])}>{percentText(stats.sameDayChangePercentByGroup[group])}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-gray-800/90 p-5">
              <h3 className="text-lg font-bold">上週總工時</h3>
              <p className="mt-1 text-xs text-gray-400">{stats.lastWeekStart} 起的完整一週</p>
              <p className="mt-4 text-3xl font-bold text-neutral">{hourFormat.format(stats.lastWeekTotalHours)} h</p>
              <p className="mt-2 text-sm text-gray-300">學弟 {hourFormat.format(stats.lastWeekTotalHoursByGroup.junior)} h · 學長 {hourFormat.format(stats.lastWeekTotalHoursByGroup.senior)} h</p>
              {otherGroup.rosterCount > 0 && <p className="mt-1 text-xs text-gray-400">其他班級 {hourFormat.format(stats.lastWeekTotalHoursByGroup.other)} h</p>}
              <Link to="/admin/dashboard#rankings" className="mt-3 inline-block text-sm font-semibold text-accent-li hover:underline">查看週報表 →</Link>
            </div>
            <div className="rounded-xl border border-white/10 bg-gray-800/90 p-5">
              <h3 className="text-lg font-bold">連續兩週無紀錄</h3>
              <p className="mt-1 text-xs text-gray-400">最近兩個完整週都沒有打卡紀錄</p>
              <p className="mt-4 text-3xl font-bold text-neutral">{stats.twoWeekNoRecordCount} 人</p>
              <p className="mt-2 text-sm text-gray-300">學弟 {stats.groups.junior.twoWeekNoRecordCount} · 學長 {stats.groups.senior.twoWeekNoRecordCount}{otherGroup.rosterCount > 0 ? ` · 其他 ${otherGroup.twoWeekNoRecordCount}` : ''}</p>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,1fr)]">
              <section className="rounded-xl border border-white/10 bg-gray-800/90 p-5">
                <h3 className="text-lg font-bold">本週工時前三名</h3>
                {stats.topWorkers.length ? (
                  <ol className="mt-4 space-y-3">
                    {stats.topWorkers.map((worker, index) => (
                      <li key={worker.email}>
                        <Link to={`/admin/dashboard?e=${encodeURIComponent(worker.email)}#userReport`} className="flex items-center justify-between gap-3 rounded-lg bg-gray-900/45 p-3 hover:bg-gray-700/60">
                          <span className="min-w-0"><span className="mr-2 text-accent-li">{index + 1}.</span><span className="font-semibold">{worker.name}</span><span className="ml-2 text-xs text-gray-400">{worker.classId}</span></span>
                          <span className="shrink-0 font-bold text-neutral">{hourFormat.format(worker.hours)} h</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : <p className="mt-4 text-sm text-gray-400">本週尚無已完成工時。</p>}
              </section>

              <section className="rounded-xl border border-white/10 bg-gray-800/90 p-5">
                <h3 className="text-lg font-bold">待處理紀錄</h3>
                <p className="mt-3 text-3xl font-bold text-amber-300">{stats.pendingRecordCount} 筆</p>
                <p className="mt-2 text-xs text-gray-400">本週有簽到但尚未簽退</p>
                {stats.pendingRecordCount > 0 && <Link to="/admin" className="mt-4 inline-block text-sm font-semibold text-accent-li hover:underline">前往打卡面板 →</Link>}
              </section>
          </div>

          <section className="rounded-xl border border-white/10 bg-gray-800/90 p-5 sm:p-6">
            <h3 className="text-lg font-bold">接著查看</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Link to="/admin/dashboard#rankings" className="rounded-lg border border-gray-600 p-4 hover:border-accent-li hover:bg-gray-700/50">團隊週報表 <span className="float-right text-accent-li">→</span></Link>
              <Link to="/admin/dashboard#userReport" className="rounded-lg border border-gray-600 p-4 hover:border-accent-li hover:bg-gray-700/50">個人月報表 <span className="float-right text-accent-li">→</span></Link>
              <Link to="/admin/batch-record" className="rounded-lg border border-gray-600 p-4 hover:border-accent-li hover:bg-gray-700/50">批次打卡 <span className="float-right text-accent-li">→</span></Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Overview;
