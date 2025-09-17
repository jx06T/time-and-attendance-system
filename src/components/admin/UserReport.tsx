import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { TimeRecord, UserProfile } from '../../types';
import { useUsers } from '../../context/UsersContext';
import { formatTime } from '../../utils/tools'
import CustomSelect from '../ui/CustomSelect';
import CustomMonthPicker from '../ui/CustomMonthPicker';
import { useToast } from '../../hooks/useToast';

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
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [selectedUserEmail, setSelectedUserEmail] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // 'YYYY-MM'
    const [monthlyRecords, setMonthlyRecords] = useState<TimeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    const { allUsers: contextUsers } = useUsers();

    useEffect(() => {
        setAllUsers(contextUsers)
    }, [contextUsers]);

    useEffect(() => {
        if (!selectedUserEmail) {
            setMonthlyRecords([]);
            return;
        };

        const fetchMonthlyRecords = async () => {
            setLoading(true);
            try {
                const [year, month] = selectedMonth.split('-').map(Number);

                // 月份開頭
                const startDateString = selectedMonth + '-01';
                const nextMonth = month === 12 ? 1 : month + 1;
                const nextYear = month === 12 ? year + 1 : year;
                const endDateString = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

                const recordsRef = collection(db, 'timeRecords');
                const q = query(recordsRef,
                    where('userEmail', '==', selectedUserEmail),
                    where('date', '>=', startDateString),
                    where('date', '<', endDateString),
                    orderBy('date', 'asc')
                );

                const recordsSnapshot = await getDocs(q);
                const recordsList = recordsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeRecord));
                setMonthlyRecords(recordsList);

            } catch (err: any) {
                addToast(`載入打卡紀錄失敗: ${err.message}`, "error");
                console.error("錯誤：", err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchMonthlyRecords();
    }, [selectedUserEmail, selectedMonth]);

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
                text: `${allUsers.find(e => e.email === selectedUserEmail)?.name} 的 ${selectedMonth} 報表`,
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
        labels: reportData.labels,
        datasets: [{
            label: '每日工時',
            data: reportData.dailyHours,
            fill: true,
            backgroundColor: 'rgb(64, 47, 113,0.7)',
            borderColor: 'rgb(212, 145, 255)',
            tension: 0.1
        }],
    };

    return (
        <>
            <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">單人報表</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <CustomSelect
                        value={selectedUserEmail}
                        onChange={setSelectedUserEmail}
                        options={allUsers}
                        placeholder="選擇使用者"
                    />
                    <CustomMonthPicker
                        value={selectedMonth}
                        onChange={setSelectedMonth}
                    />
                </div>

                {loading && <p className="text-center">載入中...</p>}

                {!loading && selectedUserEmail && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center text-neutral">
                            <div className="bg-gray-900 p-4 rounded"><p className="text-sm text-gray-400">總工時</p><p className="text-2xl font-bold">{reportData.totalHours.toFixed(2)} H</p></div>
                            <div className="bg-gray-900 p-4 rounded"><p className="text-sm text-gray-400">工作天數</p><p className="text-2xl font-bold">{reportData.workDays} D</p></div>
                            <div className="bg-gray-900 p-4 rounded col-span-2 md:col-span-1"><p className="text-sm text-gray-400">平均每日工時</p><p className="text-2xl font-bold">{reportData.avgHours.toFixed(2)} H/D</p></div>
                        </div>

                        <div><Line options={chartOptions} data={chartData} /></div>

                        <div>
                            <h3 className="text-xl font-bold mb-4 mt-10">詳細打卡紀錄</h3>
                            <div className="overflow-x-auto max-h-96 bg-gray-900 rounded">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-700 sticky top-0">
                                        <tr>
                                            <th className="p-3 px-4">日期</th><th className="p-3 px-4">簽到</th><th className="p-3 px-4">簽退</th><th className="p-3 px-4">扣時&備註</th><th className="p-3 px-4">工時</th>
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
                                                <tr key={record.id} className=" not-last:border-b border-accent">
                                                    <td className="p-3 px-4">{record.date}</td>
                                                    <td className="p-3 px-4">{formatTime(record.checkIn)}</td>
                                                    <td className="p-3 px-4">{formatTime(record.checkOut)}</td>
                                                    <td className={`p-3 px-4 ${record.notes ? " cursor-pointer" : ""}`} onClick={() => {
                                                        if (record.notes) {
                                                            addToast(`扣時原因：${record.notes}`,'success',100000)
                                                        }
                                                    }}>{(record.deductionMinutes || 0) + (record.notes ? " *" : "")}</td>
                                                    <td className="p-3 px-4 font-semibold">{hours > 0 ? hours.toFixed(2) : '-'}</td>
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
            <div className=' w-full h-32 bg-transparent'></div>
        </>

    );
};

export default UserReport;