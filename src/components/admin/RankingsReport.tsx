import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { TimeRecord, UserProfile } from '../../types';
import { useUsers } from '../../context/UsersContext';

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

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

interface Ranking extends UserProfile {
    totalHours: number;
}

function RankingsReport() {
    const [weekStart, setWeekStart] = useState<Date>(() => {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    });
    const [rankings, setRankings] = useState<Ranking[]>([]);
    const [loading, setLoading] = useState(false);
    const { allUsers } = useUsers();

    useEffect(() => {
        const fetchRankings = async () => {
            setLoading(true);

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            const recordsRef = collection(db, 'timeRecords');
            const q = query(
                recordsRef,
                where('checkIn', '>=', Timestamp.fromDate(weekStart)),
                where('checkIn', '<=', Timestamp.fromDate(weekEnd))
            );
            const recordsSnapshot = await getDocs(q);
            const weekRecords = recordsSnapshot.docs.map(doc => doc.data() as TimeRecord);

            const usersMap = new Map<string, UserProfile>();
            allUsers.forEach(user => {
                usersMap.set(user.email, user);
            });

            const userHours = new Map<string, number>();
            weekRecords.forEach(record => {
                const email = record.userEmail;
                if (record.checkIn && record.checkOut && email) {
                    const deductionMillis = (record.deductionMinutes || 0) * 60 * 1000;
                    const durationMillis = record.checkOut.toMillis() - record.checkIn.toMillis() - deductionMillis;
                    const hours = Math.max(0, durationMillis / (1000 * 60 * 60));

                    const currentHours = userHours.get(email) || 0;
                    userHours.set(email, currentHours + hours);
                }
            });

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

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    color: '#FFFFFF',
                    font: {
                        size: 14,
                    },
                },
            },
            title: {
                display: true,
                text: `當週排名 (${weekStart.toLocaleDateString()})`,
                color: '#FFFFFF',
                font: {
                    size: 18,
                },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: { color: '#BBB' },
                grid: { color: '#4B5563' },
            },
            x: {
                ticks: {
                    color: '#EEE', font: {
                        size: 14,
                    },
                },
                grid: { color: '#4B5563' },
            }
        }
    };

    const chartData = {
        labels: rankings.slice(0, 10).map(r => r.name),
        datasets: [
            {
                label: '總工時',
                data: rankings.slice(0, 10).map(r => r.totalHours),
                backgroundColor: 'rgb(64, 47, 113,0.7)',
                borderColor: 'rgb(212, 145, 255)',
                borderWidth: 1,
            },
        ],
    };

    return (
        <div>
            <div className="flex justify-center items-center gap-4 mb-8">
                <button onClick={() => handleWeekChange(-1)} className="p-1.5 px-2.5 border-2 border-accent-li text-accent-li rounded cursor-pointer">&lt; 上一週</button>
                <span className="font-semibold text-lg">{weekStart.toLocaleDateString()} - {new Date(new Date(weekStart).setDate(weekStart.getDate() + 6)).toLocaleDateString()}</span>
                <button onClick={() => handleWeekChange(1)} className="p-1.5 px-2.5 border-2 border-accent-li text-accent-li rounded cursor-pointer">下一週 &gt;</button>
            </div>

            {loading ? <p className="text-center">正在載入當週排名...</p> : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-28">
                    <div className="lg:col-span-2 bg-gray-800 p-4 rounded-lg">
                        <Bar options={chartOptions} data={chartData} />
                    </div>

                    <div className="bg-gray-800 p-4 rounded-lg">
                        <h3 className="text-xl font-bold mb-4">詳細報表</h3>
                        <ul className="space-y-3">
                            {rankings.map((user, index) => (
                                <li key={user.id || user.email} className={`p-2 rounded border border-accent-li bg-opacity-30 `}>
                                    <span className=" text-neutral mr-2">{index + 1}. {user.name}</span>
                                    <span className="text-gray-300">－ {user.totalHours.toFixed(2)} 小時</span>
                                </li>
                            ))}
                            {rankings.length === 0 && <p className="text-gray-500">該週無打卡紀錄</p>}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RankingsReport;