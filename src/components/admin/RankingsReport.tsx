import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { TimeRecord, UserProfile } from '../../types';

// 1. 引入 Chart.js 的必要模块
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// 2. 注册 Chart.js 需要使用的组件
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

// 定义排名数据的接口
interface Ranking extends UserProfile {
    totalHours: number;
}

function RankingsReport() {
    const [weekStart, setWeekStart] = useState<Date>(() => {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // 周一作为一周的开始
        const monday = new Date(today.setDate(diff));
        monday.setHours(0, 0, 0, 0); // 将时间设置为当天的开始
        return monday;
    });
    const [rankings, setRankings] = useState<Ranking[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchRankings = async () => {
            setLoading(true);

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999); // 将时间设置为当周的结束

            // 1. 获取该周所有打卡记录
            const recordsRef = collection(db, 'timeRecords');
            const q = query(
                recordsRef,
                where('checkIn', '>=', Timestamp.fromDate(weekStart)),
                where('checkIn', '<=', Timestamp.fromDate(weekEnd))
            );
            const recordsSnapshot = await getDocs(q);
            const weekRecords = recordsSnapshot.docs.map(doc => doc.data() as TimeRecord);

            // 2. 获取所有用户资料 (在 AdminPage 中，我们可以考虑将这个作为 prop 传入以避免重复获取)
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersMap = new Map<string, UserProfile>();
            usersSnapshot.forEach(doc => {
                const data = doc.data();
                usersMap.set(data.email, { id: doc.id, ...data } as UserProfile);
            });

            // 3. 计算每个用户的总工时
            const userHours = new Map<string, number>();
            weekRecords.forEach(record => {
                const email = record.userEmail;
                if (record.checkIn && record.checkOut && email) {
                    // 增加扣除时间的计算
                    const deductionMillis = (record.deductionMinutes || 0) * 60 * 1000;
                    const durationMillis = record.checkOut.toMillis() - record.checkIn.toMillis() - deductionMillis;
                    const hours = Math.max(0, durationMillis / (1000 * 60 * 60)); // 避免负数

                    const currentHours = userHours.get(email) || 0;
                    userHours.set(email, currentHours + hours);
                }
            });

            // 4. 组合数据并排序
            const finalRankings: Ranking[] = [];
            userHours.forEach((totalHours, email) => {
                const userProfile = usersMap.get(email);
                if (userProfile) {
                    finalRankings.push({ ...userProfile, totalHours });
                }
            });
            finalRankings.sort((a, b) => b.totalHours - a.totalHours);

            setRankings(finalRankings);
            setLoading(false);
        };

        fetchRankings();
    }, [weekStart]);

    const handleWeekChange = (offset: number) => {
        setWeekStart(prev => {
            const newDate = new Date(prev);
            newDate.setDate(prev.getDate() + offset * 7);
            return newDate;
        });
    };

    // --- 核心修改: 为长条图准备数据 ---
    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
                text: `当周工时排名 (${weekStart.toLocaleDateString()})`,
                color: '#FFFFFF'
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: { color: '#9CA3AF' }, // Y轴刻度颜色
                grid: { color: '#4B5563' }, // Y轴网格线颜色
            },
            x: {
                ticks: { color: '#9CA3AF' }, // X轴刻度颜色
                grid: { color: '#4B5563' }, // X轴网格线颜色
            }
        }
    };

    const chartData = {
        // X轴：显示排名前 10 的用户名
        labels: rankings.slice(0, 10).map(r => r.name),
        datasets: [
            {
                label: '总工时 (小时)',
                // Y轴：显示对应的总工时
                data: rankings.slice(0, 10).map(r => r.totalHours),
                backgroundColor: 'rgba(59, 130, 246, 0.5)', // 蓝色半透明背景
                borderColor: 'rgba(59, 130, 246, 1)', // 蓝色边框
                borderWidth: 1,
            },
        ],
    };

    return (
        <div>
            {/* 日期选择器 */}
            <div className="flex justify-center items-center gap-4 mb-8">
                <button onClick={() => handleWeekChange(-1)} className="p-2 border border-gray-600 rounded hover:bg-gray-700">&lt; 上一週</button>
                <span className="font-semibold text-lg">{weekStart.toLocaleDateString()} - {new Date(new Date(weekStart).setDate(weekStart.getDate() + 6)).toLocaleDateString()}</span>
                <button onClick={() => handleWeekChange(1)} className="p-2 border border-gray-600 rounded hover:bg-gray-700">下一週 &gt;</button>
            </div>

            {loading ? <p className="text-center">正在载入排名数据...</p> : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* 左侧：长条图 */}
                    <div className="lg:col-span-2 bg-gray-800 p-4 rounded-lg">
                        <Bar options={chartOptions} data={chartData} />
                    </div>

                    {/* 右侧：详细排名列表 */}
                    <div className="bg-gray-800 p-4 rounded-lg">
                        <h3 className="text-lg font-bold mb-4">详细排名</h3>
                        <ol className="list-decimal list-inside space-y-2">
                            {rankings.map((user, index) => (
                                <li key={user.id || user.email} className={`p-2 rounded ${index < 3 ? 'bg-yellow-800 bg-opacity-30' : ''}`}>
                                    <span className="font-bold text-white mr-2">{index + 1}. {user.name}</span>
                                    <span className="text-gray-300">- {user.totalHours.toFixed(2)} 小时</span>
                                </li>
                            ))}
                            {rankings.length === 0 && <p className="text-gray-500">该周无打卡记录。</p>}
                        </ol>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RankingsReport;