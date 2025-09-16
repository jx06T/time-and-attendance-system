import  { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { TimeRecord, UserProfile } from '../../types';

// 1. 引入 Chart.js 的必要模块，这次需要 LineElement 和 PointElement
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// 2. 注册 Chart.js 需要使用的组件
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

function UserReport() {
    // --- State 管理 ---
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [selectedUserEmail, setSelectedUserEmail] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // 'YYYY-MM'
    const [monthlyRecords, setMonthlyRecords] = useState<TimeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // --- 数据获取：首次加载所有用户列表 ---
    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                const usersSnapshot = await getDocs(collection(db, 'users'));
                const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
                setAllUsers(usersList);
            } catch (err: any) {
                setError(`载入使用者列表失败: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    // --- 数据获取：当选择的用户或月份改变时，获取对应的打卡记录 ---
    useEffect(() => {
        if (!selectedUserEmail) {
            setMonthlyRecords([]);
            return;
        };

        const fetchMonthlyRecords = async () => {
            setLoading(true);
            setError('');
            try {
                const [year, month] = selectedMonth.split('-').map(Number);

                // 1. 创建字符串格式的起止日期
                const startDateString = selectedMonth + '-01'; // 例如: "2025-09-01"
                const nextMonth = month === 12 ? 1 : month + 1;
                const nextYear = month === 12 ? year + 1 : year;
                const endDateString = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`; // 例如: "2025-10-01"

                const recordsRef = collection(db, 'timeRecords');
                const q = query(recordsRef,
                    where('userEmail', '==', selectedUserEmail),
                    where('date', '>=', startDateString), // 2. 使用字符串进行比较
                    where('date', '<', endDateString),     // 2. 使用字符串进行比较
                    orderBy('date', 'asc')                 // 3. 加上 orderBy 以保证顺序
                );

                const recordsSnapshot = await getDocs(q);
                const recordsList = recordsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeRecord));
                setMonthlyRecords(recordsList);

            } catch (err: any) {
                setError(`载入打卡纪录失败: ${err.message}`);
                console.error("需要复合索引 on timeRecords: userEmail (asc), date (asc)");
            } finally {
                setLoading(false);
            }
        };

        fetchMonthlyRecords();
    }, [selectedUserEmail, selectedMonth]);

    // --- 数据处理：使用 useMemo 优化报表和图表数据的计算 ---
    const reportData = useMemo(() => {
        const totalDays = new Date(parseInt(selectedMonth.slice(0, 4)), parseInt(selectedMonth.slice(5, 7)), 0).getDate();
        const dailyHours = Array(totalDays).fill(0);
        let totalHours = 0;
        let workDays = 0;

        monthlyRecords.forEach(record => {
            if (record.checkIn && record.checkOut) {
                const dayOfMonth = record.checkIn.toDate().getDate() - 1; // getDay() is day of week, getDate() is day of month
                const deductionMillis = (record.deductionMinutes || 0) * 60 * 1000;
                const durationMillis = record.checkOut.toMillis() - record.checkIn.toMillis() - deductionMillis;
                const hours = Math.max(0, durationMillis / (1000 * 60 * 60));

                dailyHours[dayOfMonth] = hours;
                totalHours += hours;
                if (hours > 0) {
                    workDays++;
                }
            }
        });

        const avgHours = workDays > 0 ? totalHours / workDays : 0;

        return {
            labels: Array.from({ length: totalDays }, (_, i) => i + 1),
            dailyHours,
            totalHours,
            workDays,
            avgHours
        };
    }, [monthlyRecords, selectedMonth]);

    // --- 图表配置 ---
    const chartOptions = { /* ... (与之前类似，可自定义) ... */ };
    const chartData = {
        labels: reportData.labels,
        datasets: [{
            label: '每日工时 (小时)',
            data: reportData.dailyHours,
            fill: true,
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderColor: 'rgba(59, 130, 246, 1)',
            tension: 0.1
        }],
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-4">查看单人报表</h3>
            {error && <p className="text-red-400 mb-4">{error}</p>}

            {/* 控制区域 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <select value={selectedUserEmail} onChange={e => setSelectedUserEmail(e.target.value)} className="w-full p-2 bg-gray-700 rounded">
                    <option value="">-- 请选择一位使用者 --</option>
                    {allUsers.map(user => <option key={user.id} value={user.email}>{user.name} ({user.email})</option>)}
                </select>
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full p-2 bg-gray-700 rounded" />
            </div>

            {loading && <p className="text-center">载入中...</p>}

            {!loading && selectedUserEmail && (
                <div className="space-y-8 animate-fade-in">
                    {/* 数据总览 */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                        <div className="bg-gray-900 p-4 rounded"><p className="text-sm text-gray-400">总工时</p><p className="text-2xl font-bold">{reportData.totalHours.toFixed(2)} H</p></div>
                        <div className="bg-gray-900 p-4 rounded"><p className="text-sm text-gray-400">工作天数</p><p className="text-2xl font-bold">{reportData.workDays} D</p></div>
                        <div className="bg-gray-900 p-4 rounded col-span-2 md:col-span-1"><p className="text-sm text-gray-400">平均每日工时</p><p className="text-2xl font-bold">{reportData.avgHours.toFixed(2)} H/D</p></div>
                    </div>

                    {/* 图表 */}
                    <div><Line options={chartOptions} data={chartData} /></div>

                    {/* 详细记录列表 */}
                    <div>
                        <h4 className="font-bold mb-2">详细记录</h4>
                        <div className="overflow-x-auto max-h-96 bg-gray-900 rounded">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-700 sticky top-0">
                                    <tr>
                                        <th className="p-2">日期</th><th className="p-2">签到</th><th className="p-2">签退</th><th className="p-2">扣时(分)</th><th className="p-2">工时</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthlyRecords.map(record => {
                                        let hours = 0;
                                        if (record.checkIn && record.checkOut) {
                                            const deductionMillis = (record.deductionMinutes || 0) * 60 * 1000;
                                            hours = Math.max(0, (record.checkOut.toMillis() - record.checkIn.toMillis() - deductionMillis) / (1000 * 60 * 60));
                                        }
                                        return (
                                            <tr key={record.id} className="border-b border-gray-700">
                                                <td className="p-2">{record.date}</td>
                                                <td className="p-2">{record.checkIn?.toDate().toLocaleTimeString()}</td>
                                                <td className="p-2">{record.checkOut?.toDate().toLocaleTimeString() || '-'}</td>
                                                <td className="p-2">{record.deductionMinutes || 0}</td>
                                                <td className="p-2 font-semibold">{hours > 0 ? hours.toFixed(2) : '-'}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserReport;