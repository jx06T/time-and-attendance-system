import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
} from 'chart.js';
import type { ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';

import { db } from '../../firebase';
import { useUsers } from '../../context/UsersContext';
import type { TimeRecord } from '../../types';
import { toLocalDateString } from '../../utils/tools';
import { calculateOverviewStats } from '../../utils/overviewStats';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

const hourFormat = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-gray-800/90 p-4 sm:p-5">
      <p className="text-sm text-gray-300">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-neutral sm:text-4xl">{value}</p>
      <p className="mt-2 text-xs leading-5 text-gray-400">{detail}</p>
    </div>
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
      currentMonday.setDate(currentMonday.getDate() - (weekday === 0 ? 6 : weekday - 1) - 8 * 7);
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
  const attendancePercent = stats.rosterCount > 0 ? (stats.attendeeCount / stats.rosterCount) * 100 : 0;
  const groupedHours = stats.juniorHours + stats.seniorHours;
  const juniorPercent = groupedHours > 0 ? (stats.juniorHours / groupedHours) * 100 : 0;
  const loading = usersLoading || recordsLoading;

  const chartData = {
    labels: stats.trend.map(point => point.weekStart.slice(5).replace('-', '/')),
    datasets: [{
      label: '完成工時',
      data: stats.trend.map(point => Number(point.hours.toFixed(2))),
      borderColor: '#d491ff',
      backgroundColor: '#d491ff',
      pointBackgroundColor: '#02151c',
      pointBorderWidth: 2,
      pointRadius: 4,
      tension: 0.3,
    }],
  };
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: context => `${hourFormat.format(Number(context.parsed.y))} 小時` } },
    },
    scales: {
      x: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.06)' } },
      y: { beginAtZero: true, ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.12)' }, title: { display: true, text: '小時', color: '#cbd5e1' } },
    },
  };

  return (
    <div className="space-y-6 pb-28">
      <section className="overflow-hidden rounded-2xl border border-accent-li/30 bg-gradient-to-br from-accent/70 via-gray-800 to-brand p-6 sm:p-8">
        <p className="text-sm font-semibold tracking-[0.2em] text-accent-li">TEAM OVERVIEW</p>
        <h2 className="mt-2 text-3xl font-bold">本週總預覽</h2>
        <p className="mt-2 text-sm text-gray-200">{stats.weekStart} 至 {todayDate} · 以目前使用者名冊計算</p>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-gray-300">到場以簽到紀錄判定。工時只計算已簽退紀錄，並扣除紀錄中的扣時；未簽退者仍算到場。</p>
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
          {stats.rosterCount === 0 && (
            <div className="rounded-xl border border-gray-600 bg-gray-800 p-4 text-sm text-gray-200">
              目前沒有使用者名冊。<button type="button" onClick={() => void fetchUsers()} className="ml-2 font-semibold text-accent-li underline">重新載入名冊</button>
            </div>
          )}

          <section aria-label="本週指標" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="總工作時間" value={`${hourFormat.format(stats.totalHours)} h`} detail="本週已完成紀錄的淨工時" />
            <MetricCard label="到場者平均工時" value={`${hourFormat.format(stats.averageHours)} h`} detail="總工時 ÷ 本週有簽到的人數" />
            <MetricCard label="有來的人" value={`${stats.attendeeCount} 人`} detail={`目前名冊共 ${stats.rosterCount} 人`} />
            <MetricCard label="沒有來的人" value={`${stats.absentCount} 人`} detail="名冊中本週沒有簽到紀錄" />
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
            <section className="rounded-xl border border-white/10 bg-gray-800/90 p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-xl font-bold">整體工時趨勢</h3>
                  <p className="mt-1 text-sm text-gray-400">最近 8 個完整週 · 每週已完成淨工時</p>
                </div>
                <Link to="/admin/dashboard#rankings" className="text-sm font-semibold text-accent-li hover:underline">查看週報表 →</Link>
              </div>
              <div className="h-64 sm:h-72"><Line data={chartData} options={chartOptions} /></div>
            </section>

            <div className="space-y-6">
              <section className="rounded-xl border border-white/10 bg-gray-800/90 p-5">
                <h3 className="text-lg font-bold">本週到場</h3>
                <p className="mt-3 text-3xl font-bold text-accent-li">{hourFormat.format(attendancePercent)}%</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-700">
                  <div className="h-full rounded-full bg-accent-li" style={{ width: `${attendancePercent}%` }} />
                </div>
                <p className="mt-3 text-sm text-gray-300">{stats.attendeeCount} 人已到場 · {stats.absentCount} 人尚未到場</p>
                {stats.pendingRecordCount > 0 && (
                  <Link to="/admin" className="mt-4 inline-block text-sm font-semibold text-amber-300 hover:underline">
                    {stats.pendingRecordCount} 筆未簽退紀錄，前往處理 →
                  </Link>
                )}
              </section>

              <section className="rounded-xl border border-white/10 bg-gray-800/90 p-5">
                <h3 className="text-lg font-bold">年級工時</h3>
                <p className="mt-1 text-xs text-gray-400">依班級首碼：1 為學弟；2、3 為學長</p>
                <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-gray-700">
                  <div className="bg-sky-400" style={{ width: `${juniorPercent}%` }} />
                  <div className="bg-accent-li" style={{ width: `${groupedHours > 0 ? 100 - juniorPercent : 0}%` }} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div><p className="text-sm text-gray-300">學弟（1 年級）</p><p className="mt-1 text-xl font-bold text-sky-300">{hourFormat.format(stats.juniorHours)} h</p></div>
                  <div><p className="text-sm text-gray-300">學長（2、3 年級）</p><p className="mt-1 text-xl font-bold text-accent-li">{hourFormat.format(stats.seniorHours)} h</p></div>
                </div>
                {stats.otherHours > 0 && <p className="mt-3 text-xs text-gray-400">其他班級：{hourFormat.format(stats.otherHours)} h，已計入總工時。</p>}
              </section>
            </div>
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
