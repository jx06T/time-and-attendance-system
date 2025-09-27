import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { TimeRecord, UserProfile } from '../../types';
import { useUsers } from '../../context/UsersContext';
import { useToast } from '../../hooks/useToast';
import { useNavigate } from 'react-router-dom';

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

import BasicSelect, { SelectOption } from '../ui/BasicSelect';

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
    _dailyHours?: Map<number, number>;
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

    const [allRankingsForWeek, setAllRankingsForWeek] = useState<Ranking[]>([]);
    const [loading, setLoading] = useState(false);
    const { allUsers } = useUsers();
    const { addToast } = useToast();
    const [isPublishing, setIsPublishing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('');
    const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<string>('');
    const [minHours, setMinHours] = useState<string>('');
    const [maxHours, setMaxHours] = useState<string>('');


    const gradeLevelOptions: SelectOption[] = useMemo(() => [
        { value: '', label: '全部人' },
        { value: '1', label: '學弟' },
        { value: '2', label: '同屆' },
    ], []);

    const dayOfWeekOptions: SelectOption[] = useMemo(() => [
        { value: '', label: '不限' },
        { value: '1', label: '星期一' },
        { value: '2', label: '星期二' },
        { value: '3', label: '星期三' },
        { value: '4', label: '星期四' },
        { value: '5', label: '星期五' },
        { value: '6', label: '星期六' },
        { value: '0', label: '星期日' },
    ], []);


    // 此 useEffect 只負責獲取一整週的原始數據，不包含任何客戶端篩選
    useEffect(() => {
        const fetchRawWeeklyData = async () => {
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

            // 首先計算所有用戶在一週內的總時數，無論他們是否符合年級篩選
            const userTotalHoursMap = new Map<string, number>();
            const userDailyHoursMap = new Map<string, Map<number, number>>(); // 用來儲存每天的時數

            weekRecords.forEach(record => {
                const email = record.userEmail;
                if (record.checkIn && record.checkOut && email) {
                    const deductionMillis = (record.deductionMinutes || 0) * 60 * 1000;
                    const durationMillis = record.checkOut.toMillis() - record.checkIn.toMillis() - deductionMillis;
                    const hours = Math.max(0, durationMillis / (1000 * 60 * 60));

                    // 計算總時數
                    const currentTotalHours = userTotalHoursMap.get(email) || 0;
                    userTotalHoursMap.set(email, currentTotalHours + hours);

                    // 計算每天的時數，用於後續的星期幾篩選
                    const dayOfWeek = record.checkIn.toDate().getDay();
                    if (!userDailyHoursMap.has(email)) {
                        userDailyHoursMap.set(email, new Map());
                    }
                    const currentDayHours = userDailyHoursMap.get(email)!.get(dayOfWeek) || 0;
                    userDailyHoursMap.get(email)!.set(dayOfWeek, currentDayHours + hours);
                }
            });

            // 結合 allUsers 和計算出的時數，生成原始排名數據
            const rawRankings: Ranking[] = [];
            allUsers.forEach(user => {
                const totalHours = userTotalHoursMap.get(user.email) || 0;
                rawRankings.push({ ...user, totalHours, _dailyHours: userDailyHoursMap.get(user.email) || new Map() }); // 暫時儲存每天時數
            });

            setAllRankingsForWeek(rawRankings); // 儲存原始未篩選的週數據
            setLoading(false);
        };

        fetchRawWeeklyData();
    }, [weekStart, allUsers]);


    // handlePublishRankings 保持不變，它應該對 displayRankings (即已篩選和排序的數據) 進行操作
    const handlePublishRankings = async () => {
        // 發布時，使用當前在界面上顯示的 (已篩選和排序的) displayRankings
        const rankingsToPublish = displayRankings;

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

                publishedFilters: { 
                    gradeLevel: selectedGradeLevel,
                    dayOfWeek: selectedDayOfWeek,
                    minHours: minHours,
                    maxHours: maxHours,
                    searchTerm: searchTerm,
                }
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
        // 切換週時，重置所有篩選條件，避免混亂
        setSearchTerm('');
        setSelectedGradeLevel('');
        setSelectedDayOfWeek('');
        setMinHours('');
        setMaxHours('');
    };

    // 此 useMemo 將處理所有客戶端篩選和排序
    const displayRankings = useMemo((): Ranking[] => {
        let currentRankings = [...allRankingsForWeek]; // 從原始數據開始

        // 1. 關鍵字搜尋
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            currentRankings = currentRankings.filter(user => (
                user.name.toLowerCase().includes(lowercasedTerm) ||
                user.classId?.toLowerCase().includes(lowercasedTerm) || // classId 可能為 undefined
                user.seatNo?.toLowerCase().includes(lowercasedTerm) || // seatNo 可能為 undefined
                user.email.toLowerCase().includes(lowercasedTerm) ||
                `${user.classId || ''}${user.seatNo || ''}`.startsWith(lowercasedTerm))
            );
        }

        // 2. 年級篩選
        if (selectedGradeLevel) {
            currentRankings = currentRankings.filter(user => user.classId && user.classId.startsWith(selectedGradeLevel));
        }

        // 3. 星期幾篩選 (需要重新計算 totalHours)
        if (selectedDayOfWeek !== '') {
            const targetDay = parseInt(selectedDayOfWeek, 10);
            currentRankings = currentRankings.map(user => {
                const dailyHoursMap = user._dailyHours as Map<number, number>; // 假設 _dailyHours 存在
                const totalHoursForDay = dailyHoursMap.get(targetDay) || 0;
                return { ...user, totalHours: totalHoursForDay }; // 將 totalHours 更新為單日的時數
            });
            // 篩選掉當天沒有時數的用戶
            currentRankings = currentRankings.filter(user => user.totalHours > 0);

        }

        // 4. 時數區間篩選
        const minH = parseFloat(minHours);
        const maxH = parseFloat(maxHours);

        if (!isNaN(minH) && minH >= 0) {
            currentRankings = currentRankings.filter(ranking => ranking.totalHours >= minH);
        }
        if (!isNaN(maxH) && maxH >= 0) {
            currentRankings = currentRankings.filter(ranking => ranking.totalHours <= maxH);
        }

        // 5. 排序
        currentRankings.sort((a, b) => b.totalHours - a.totalHours);

        return currentRankings;
    }, [allRankingsForWeek, searchTerm, selectedGradeLevel, selectedDayOfWeek, minHours, maxHours]);

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
                text: `當週排名 (${weekStart.toLocaleDateString()}${selectedGradeLevel ? ` - ${gradeLevelOptions.find(o => o.value === selectedGradeLevel)?.label}` : ''}${selectedDayOfWeek ? ` - ${dayOfWeekOptions.find(o => o.value === selectedDayOfWeek)?.label}` : ''}${minHours || maxHours ? ` - 時數 ${minHours || '0'}~${maxHours || '不限'}` : ''})`,
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

    const handleGoToUserReport = (email: string) => {
        navigate(`/admin/dashboard?e=${email}#userReport`);
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
                        <div className="mb-4 flex flex-col gap-3">
                            <input
                                type="text"
                                placeholder="按關鍵字搜尋使用者..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="flex-grow p-2 bg-gray-700 border border-gray-600 rounded"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <BasicSelect
                                    options={gradeLevelOptions}
                                    value={selectedGradeLevel}
                                    onChange={setSelectedGradeLevel}
                                />
                                <BasicSelect
                                    options={dayOfWeekOptions}
                                    value={selectedDayOfWeek}
                                    onChange={setSelectedDayOfWeek}
                                />
                            </div>

                            <div className="flex gap-2 items-center ">
                                <input
                                    type="number"
                                    placeholder="大於"
                                    value={minHours}
                                    onChange={e => setMinHours(e.target.value)}
                                    className="w-1/2  h-10 p-2 bg-gray-700 border border-gray-600 rounded"
                                    min="0"
                                />
                                <span className="text-gray-300">～</span>
                                <input
                                    type="number"
                                    placeholder="小於"
                                    value={maxHours}
                                    onChange={e => setMaxHours(e.target.value)}
                                    className="w-1/2  h-10 p-2 bg-gray-700 border border-gray-600 rounded"
                                    min="0"
                                />
                            </div>
                        </div>
                        <ul className="space-y-3">
                            {displayRankings.map((user, index) => (
                                <li key={user.id || user.email} className={`p-2 rounded border border-accent-li bg-opacity-30 flex justify-between items-center`}>
                                    <div>
                                        <span className=" text-neutral mr-2">{index + 1}. {user.name} ({user.classId || 'N/A'})</span>
                                        <span className="text-gray-300">－ {user.totalHours.toFixed(2)} 小時</span>
                                    </div>
                                    <button
                                        onClick={() => handleGoToUserReport(user.email)}
                                        className=""
                                        title="查看用戶報告"
                                    >
                                        <span className="text-accent-li text-2xl font-bold mr-1">&rarr;</span>
                                    </button>
                                </li>
                            ))}
                            {displayRankings.length === 0 && <p className="text-gray-500">該週無打卡紀錄</p>}
                        </ul>
                        <div className=" mt-4">
                            <button
                                onClick={handlePublishRankings}
                                disabled={isPublishing || displayRankings.length === 0}
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