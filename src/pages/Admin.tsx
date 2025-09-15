import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { TimeRecord, UserProfile } from '../types';

interface Ranking extends UserProfile {
    totalHours: number;
}

const AdminPage = () => {
    const [weekStart, setWeekStart] = useState<Date>(() => {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        return new Date(today.setDate(diff));
    });
    const [rankings, setRankings] = useState<Ranking[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchRankings = async () => {
            setLoading(true);

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);

            // 1. 取得該週所有打卡紀錄
            const recordsRef = collection(db, 'timeRecords');
            const q = query(
                recordsRef,
                where('checkIn', '>=', Timestamp.fromDate(weekStart)),
                where('checkIn', '<=', Timestamp.fromDate(weekEnd))
            );
            const recordsSnapshot = await getDocs(q);
            const weekRecords = recordsSnapshot.docs.map(doc => doc.data() as TimeRecord);

            // 2. 取得所有使用者資料 (為簡化，一次全抓，大量用戶時需優化)
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersMap = new Map<string, UserProfile>();
            usersSnapshot.forEach(doc => {
                usersMap.set(doc.id, { uid: doc.id, ...doc.data() } as UserProfile);
            });

            // 3. 計算每位使用者的總時數
            const userHours = new Map<string, number>();
            weekRecords.forEach(record => {
                if (record.checkIn && record.checkOut) {
                    const hours = (record.checkOut.toMillis() - record.checkIn.toMillis()) / 1000 / 60 / 60;
                    const currentHours = userHours.get(record.userId) || 0;
                    userHours.set(record.userId, currentHours + hours);
                }
            });

            // 4. 組合資料並排序
            const finalRankings: Ranking[] = [];
            userHours.forEach((totalHours, userId) => {
                const userProfile = usersMap.get(userId);
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

    return (
        <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl text-center mb-6">當週排名</h2>
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => handleWeekChange(-1)} className="p-2 border rounded">&lt; 上一週</button>
                <span>{weekStart.toISOString().slice(0, 10)}</span>
                <button onClick={() => handleWeekChange(1)} className="p-2 border rounded">下一週 &gt;</button>
            </div>

            {loading ? <p>載入中...</p> : (
                <ol className="list-decimal list-inside bg-gray-800 p-4 rounded">
                    {rankings.map((user, index) => (
                        <li key={user.uid} className="p-2 border-b border-gray-700">
                            <span className="font-bold text-lg mr-4">{index + 1}. {user.name}</span>
                            <span>- 總時數: {user.totalHours.toFixed(2)} 小時</span>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
};

export default AdminPage;