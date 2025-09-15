import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, setDoc, updateDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { TimeRecord, UserProfile } from '../types';

// 這個頁面現在是【管理員專用】，用來為特定員工打卡或修改紀錄
const RecordPage = () => {
    // 變更 1: URL 參數從 userId 改為 userEmail
    const { userEmail } = useParams<{ userEmail: string }>(); 
    const navigate = useNavigate();

    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [record, setRecord] = useState<TimeRecord | null>(null);
    const [loading, setLoading] = useState(true);

    // 取得今天的 YYYY-MM-DD 格式日期
    const todayStr = new Date().toISOString().slice(0, 10);

    useEffect(() => {
        const fetchData = async () => {
            if (!userEmail) {
                setLoading(false);
                return;
            }
            setLoading(true);

            // 變更 2: 根據 email 查詢使用者資料，而不是用 doc ID
            const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
            const userSnapshot = await getDocs(userQuery);
            
            if (!userSnapshot.empty) {
                const userDoc = userSnapshot.docs[0];
                // 這裡的 'id' 是 Firestore 自動生成的文件 ID，和 uid 不同
                setUserProfile({ id: userDoc.id, ...userDoc.data() } as UserProfile);
            }

            // 變更 3: 根據 userEmail 和 date 取得今天的打卡紀錄
            const recordsRef = collection(db, 'timeRecords');
            const recordQuery = query(recordsRef, where('userEmail', '==', userEmail), where('date', '==', todayStr));
            const recordSnapshot = await getDocs(recordQuery);

            if (!recordSnapshot.empty) {
                const recordDoc = recordSnapshot.docs[0];
                setRecord({ id: recordDoc.id, ...recordDoc.data() } as TimeRecord);
            } else {
                setRecord(null); // 確保沒有紀錄時是 null
            }
            setLoading(false);
        };
        fetchData();
    }, [userEmail, todayStr]);

    const handleCheckIn = async () => {
        if (!userEmail) return;

        // 變更 4: 寫入的紀錄使用 userEmail 欄位
        const newRecord: Partial<TimeRecord> = {
            userEmail, // 使用 userEmail
            checkIn: Timestamp.now(),
            checkOut: null,
            date: todayStr,
        };

        // 變更 5: 使用 userEmail 和 date 組成一個可預測的文件 ID
        const recordDocRef = doc(db, 'timeRecords', `${userEmail}_${todayStr}`);
        await setDoc(recordDocRef, newRecord);
        setRecord({ id: recordDocRef.id, ...newRecord } as TimeRecord);
    };

    const handleCheckOut = async () => {
        if (!record || !record.id) return;
        const recordDocRef = doc(db, 'timeRecords', record.id);
        await updateDoc(recordDocRef, { checkOut: Timestamp.now() });
        setRecord(prev => prev ? { ...prev, checkOut: Timestamp.now() } : null);
    };

    const handleEditTime = (type: 'checkIn' | 'checkOut') => {
        // (此處邏輯不變)
        const currentTime = record?.[type]?.toDate().toLocaleTimeString('it-IT') || '未設定';
        const newTimeStr = prompt(`編輯${type === 'checkIn' ? '簽到' : '簽退'}時間`, currentTime);
        alert(`（功能開發中）新時間: ${newTimeStr}`);
    };

    if (loading) return <p className="text-center">載入中...</p>;
    if (!userProfile) return <p className="text-center text-red-400">找不到 Email 為 {userEmail} 的使用者資料。</p>;

    return (
        <div className="max-w-md mx-auto">
            <button onClick={() => navigate(-1)} className="mb-4 text-blue-400 hover:underline">
                &larr; 返回上一頁
            </button>
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
                    disabled={!record?.checkIn || !!record?.checkOut}
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

export default RecordPage;