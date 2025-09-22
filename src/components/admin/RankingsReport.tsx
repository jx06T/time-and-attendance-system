import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { TimeRecord, UserProfile } from '../../types';
import { useUsers } from '../../context/UsersContext';
import { useToast } from '../../hooks/useToast';

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

// 引入 BasicSelect 組件及其 SelectOption 類型
import BasicSelect, { SelectOption } from '../ui/BasicSelect'; // 確保路徑正確

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
    const { addToast } = useToast();
    const [isPublishing, setIsPublishing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('');

    // 定義年級篩選選項
    const gradeLevelOptions: SelectOption[] = useMemo(() => [
        { value: '', label: '全部人' },
        { value: '1', label: '學弟' },
        { value: '2', label: '同屆' },
    ], []);


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
            // 根據 selectedGradeLevel 篩選用戶
            const filteredUsers = selectedGradeLevel
                ? allUsers.filter(user => user.classId && user.classId.startsWith(selectedGradeLevel))
                : allUsers;

            filteredUsers.forEach(user => {
                usersMap.set(user.email, user);
            });

            const userHours = new Map<string, number>();
            weekRecords.forEach(record => {
                const email = record.userEmail;
                // 只有在 filteredUsersMap 中存在的用戶才計算時數
                if (record.checkIn && record.checkOut && email && usersMap.has(email)) {
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
    }, [weekStart, selectedGradeLevel, allUsers]); 

    const handlePublishRankings = async () => {
        const rankingsToPublish = rankings;

        if (rankingsToPublish.length === 0) {
            addToast("無資料可發布", 'error');
            return;
        }
        setIsPublishing(true);
        try {
            const championHours = rankingsToPublish[0].totalHours * 1.2;
            if (championHours <= 0) {
                addToast("最高時數為0，無法更新", "error");
                setIsPublishing(false);
                return;
            }

            const topFive = rankingsToPublish.slice(0, 5).map(user => ({
                name: user.name,
                classId: user.classId,
                percentage: (user.totalHours / championHours) * 100,
            }));

            const championDocRef = doc(db, 'publicData', 'weeklyChampion');
            await updateDoc(championDocRef, {
                topFive: topFive,
                updatedAt: Timestamp.now(),
                weekStartDate: Timestamp.fromDate(weekStart),
                filteredGradeLevel: selectedGradeLevel || null,
            });

            addToast("已成功發布!", "success");

        } catch (error: any) {
            addToast(`發布失敗: ${error.message}`, "error");
        } finally {
            setIsPublishing(false);
        }
    };

    const handleWeekChange = (offset: number) => {
        setWeekStart(prev => {
            const newDate = new Date(prev);
            newDate.setDate(prev.getDate() + offset * 7);
            return newDate;
        });
    };

    const displayRankings = useMemo((): Ranking[] => {
        if (!searchTerm) return rankings;
        const lowercasedTerm = searchTerm.toLowerCase();
        return rankings.filter(user => (
            user.name.toLowerCase().includes(lowercasedTerm) ||
            user.classId.toLowerCase().includes(lowercasedTerm) ||
            user.seatNo.toLowerCase().includes(lowercasedTerm) ||
            user.email.toLowerCase().includes(lowercasedTerm) ||
            `${user.classId}${user.seatNo}`.startsWith(lowercasedTerm))
        );
    }, [rankings, searchTerm]);

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
                text: `當週排名 (${weekStart.toLocaleDateString()}${selectedGradeLevel ? ` - ${selectedGradeLevel}` : ''})`,
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
        labels: displayRankings.slice(0, 10).map(r => r.name),
        datasets: [
            {
                label: '總工時',
                data: displayRankings.slice(0, 10).map(r => r.totalHours),
                backgroundColor: 'rgb(64, 47, 113,0.7)',
                borderColor: 'rgb(212, 145, 255)',
                borderWidth: 1,
            },
        ],
    };

    return (
        <div>
            <div className="flex justify-center items-center gap-4 mb-8">
                <button onClick={() => handleWeekChange(-1)} className="p-1.5 px-2.5 border-2 border-accent-li text-accent-li rounded cursor-pointer">&lt; <span className=' hidden md:inline'>上一週</span></button>
                <span className="font-semibold text-lg">{weekStart.toLocaleDateString()} - {new Date(new Date(weekStart).setDate(weekStart.getDate() + 6)).toLocaleDateString()}</span>
                <button onClick={() => handleWeekChange(1)} className="p-1.5 px-2.5 border-2 border-accent-li text-accent-li rounded cursor-pointer"><span className=' hidden md:inline'>下一週</span> &gt;</button>
            </div>

            {loading ? <p className="text-center">正在載入當週排名...</p> : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-28">
                    <div className="lg:col-span-2 bg-gray-800 p-4 rounded-lg h-fit">
                        <Bar options={chartOptions} data={chartData} />
                    </div>

                    <div className="bg-gray-800 p-4 rounded-lg">
                        <h3 className="text-xl font-bold mb-4">詳細報表</h3>
                        <div className="mb-4 flex flex-col gap-2">
                            <input
                                type="text"
                                placeholder="按關鍵字搜尋使用者..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="flex-grow p-2 bg-gray-700 border border-gray-600 rounded"
                            />
                            <BasicSelect
                                options={gradeLevelOptions}
                                value={selectedGradeLevel}
                                onChange={setSelectedGradeLevel}
                            />
                        </div>
                        <ul className="space-y-3">
                            {displayRankings.map((user, index) => (
                                <li key={user.id || user.email} className={`p-2 rounded border border-accent-li bg-opacity-30 `}>
                                    <span className=" text-neutral mr-2">{index + 1}. {user.name} ({user.classId || 'N/A'})</span>
                                    <span className="text-gray-300">－ {user.totalHours.toFixed(2)} 小時</span>
                                </li>
                            ))}
                            {displayRankings.length === 0 && <p className="text-gray-500">該週無打卡紀錄</p>}
                        </ul>
                        <div className=" mt-4">
                            <button
                                onClick={handlePublishRankings}
                                disabled={isPublishing || rankings.length === 0}
                                className="border-2 border-accent-li text-accent-li font-semibold py-2 px-4 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPublishing ? '發布中...' : '更新並發布至首頁'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RankingsReport;