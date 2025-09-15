import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { TimeRecord, UserProfile } from '../types';

const DailyRecordPage = () => {
    const { userId } = useParams<{ userId: string }>();
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [record, setRecord] = useState<TimeRecord | null>(null);
    const [loading, setLoading] = useState(true);

    // 取得今天的 YYYY-MM-DD 格式日期
    const todayStr = new Date().toISOString().slice(0, 10);

    useEffect(() => {
        const fetchData = async () => {
            if (!userId) return;
            setLoading(true);
            // 1. 取得使用者資料
            const userDocRef = doc(db, 'users', userId);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                setUserProfile({ uid: userId, ...userDocSnap.data() } as UserProfile);
            }

            // 2. 取得今天的打卡紀錄
            const recordsRef = collection(db, 'timeRecords');
            const q = query(recordsRef, where('userId', '==', userId), where('date', '==', todayStr));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                setRecord({ id: doc.id, ...doc.data() } as TimeRecord);
            } else {
                setRecord(null); // 確保沒有紀錄時是 null
            }
            setLoading(false);
        };
        fetchData();
    }, [userId, todayStr]);

    const handleCheckIn = async () => {
        if (!userId) return;
        const newRecord: TimeRecord = {
            userId,
            checkIn: Timestamp.now(),
            checkOut: null,
            date: todayStr,
        };
        // 使用 userId 和 date 組成一個可預測的文檔 ID
        const recordDocRef = doc(db, 'timeRecords', `${userId}_${todayStr}`);
        await setDoc(recordDocRef, newRecord);
        setRecord({ id: recordDocRef.id, ...newRecord });
    };

    const handleCheckOut = async () => {
        if (!record || !record.id) return;
        const recordDocRef = doc(db, 'timeRecords', record.id);
        await updateDoc(recordDocRef, { checkOut: Timestamp.now() });
        setRecord(prev => prev ? { ...prev, checkOut: Timestamp.now() } : null);
    };

    // TODO: 雙擊編輯功能 placeholder
    const handleEditTime = (type: 'checkIn' | 'checkOut') => {
        const currentTime = record?.[type]?.toDate().toLocaleTimeString('it-IT') || '未設定';
        const newTimeStr = prompt(`編輯${type === 'checkIn' ? '簽到' : '簽退'}時間`, currentTime);
        // 這裡只是 placeholder，實際功能會更複雜
        // 需要將 HH:mm 字串轉回 Timestamp 並更新 Firestore
        alert(`（功能開發中）新時間: ${newTimeStr}`);
    };

    if (loading) return <p>載入中...</p>;
    if (!userProfile) return <p>找不到使用者資料。</p>;

    return (
        <div className="max-w-md mx-auto">
            <h2 className="text-3xl text-center mb-6">{userProfile.name} - 今日打卡</h2>
            <div className="bg-gray-800 p-6 rounded-lg text-center">
                <div
                    onDoubleClick={() => record?.checkIn && handleEditTime('checkIn')}
                    className="mb-4 cursor-pointer"
                >
                    <p className="text-lg text-gray-400">簽到時間</p>
                    <p className="text-4xl">
                        {record?.checkIn ? record.checkIn.toDate().toLocaleTimeString() : '--:--:--'}
                    </p>
                </div>
                <div
                    onDoubleClick={() => record?.checkOut && handleEditTime('checkOut')}
                    className="cursor-pointer"
                >
                    <p className="text-lg text-gray-400">簽退時間</p>
                    <p className="text-4xl">
                        {record?.checkOut ? record.checkOut.toDate().toLocaleTimeString() : '--:--:--'}
                    </p>
                </div>
            </div>

            <div className="mt-8 flex justify-around">
                <button
                    onClick={handleCheckIn}
                    disabled={!!record?.checkIn}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg"
                >
                    簽到
                </button>
                <button
                    onClick={handleCheckOut}
                    disabled={!record?.checkIn || !!record.checkOut}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg"
                >
                    簽退
                </button>
            </div>
            <div className="text-center mt-8">
                <button className="text-blue-300 hover:underline">
                    額外編輯 (補打卡/扣時間)
                </button>
            </div>
        </div>
    );
};

export default DailyRecordPage;