import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { TimeRecord, UserProfile } from '../types';
import { useToast } from '../hooks/useToast';
import { formatTime } from '../utils/tools'

const AdminRecordPage = () => {
    const { userEmail } = useParams<{ userEmail: string }>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const datePickerRef = useRef<HTMLInputElement>(null);

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [record, setRecord] = useState<TimeRecord | null>(null);
    const [loading, setLoading] = useState(true);

    const [checkInInput, setCheckInInput] = useState('');
    const [checkOutInput, setCheckOutInput] = useState('');
    const [deductionInput, setDeductionInput] = useState('0');
    const [notesInput, setNotesInput] = useState('');

    const toDateString = (date: Date): string => date.toISOString().slice(0, 10);
    const isToday = toDateString(selectedDate) === toDateString(new Date());

    const fetchData = useCallback(async () => {
        if (!userEmail) {
            setLoading(false);
            return;
        }
        setLoading(true);

        const dateStr = toDateString(selectedDate);

        if (!userProfile) {
            const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
            const userSnapshot = await getDocs(userQuery);
            if (!userSnapshot.empty) {
                const userDoc = userSnapshot.docs[0];
                const userData = userDoc.data();
                setUserProfile({
                    id: userDoc.id,
                    uid: userData.uid,
                    name: userData.name,
                    classId: userData.classId,
                    seatNo: userData.seatNo,
                    email: userData.email,
                    studentId: userData.studentId,
                });
            }
        }

        const recordQuery = query(collection(db, 'timeRecords'), where('userEmail', '==', userEmail), where('date', '==', dateStr));
        const recordSnapshot = await getDocs(recordQuery);

        if (!recordSnapshot.empty) {
            const recordDoc = recordSnapshot.docs[0];
            const recordData = recordDoc.data() as TimeRecord;
            setRecord({ id: recordDoc.id, ...recordData });
            setCheckInInput(formatTime(recordData.checkIn));
            setCheckOutInput(formatTime(recordData.checkOut));
            setDeductionInput(String(recordData.deductionMinutes || 0));
            setNotesInput(recordData.notes || '');
        } else {
            setRecord(null);
            setCheckInInput('');
            setCheckOutInput('');
            setDeductionInput('0');
            setNotesInput('');
        }
        setLoading(false);
    }, [userEmail, selectedDate, userProfile]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = async () => {
        if (!userEmail) return;
        setLoading(true);
        const dateStr = toDateString(selectedDate);
        const recordDocRef = doc(db, 'timeRecords', `${userEmail}_${dateStr}`);

        const getTimestamp = (timeStr: string): Timestamp | null => {
            if (!/^\d{2}:\d{2}$/.test(timeStr)) {
                if (timeStr === '') return null;
                addToast(`時間格式錯誤: ${timeStr}，應為 HH:mm`, 'error');
                return null;
            }
            const [hours, minutes] = timeStr.split(':').map(Number);
            const date = new Date(selectedDate);
            date.setHours(hours, minutes, 0, 0);
            return Timestamp.fromDate(date);
        };

        const checkInTimestamp = getTimestamp(checkInInput);
        const checkOutTimestamp = getTimestamp(checkOutInput);

        if (checkInTimestamp === undefined || checkOutTimestamp === undefined) {
            setLoading(false);
            return;
        }

        const dataToSave: Partial<TimeRecord> = {
            userEmail,
            date: dateStr,
            checkIn: checkInTimestamp,
            checkOut: checkOutTimestamp,
            deductionMinutes: Number(deductionInput) || 0,
            notes: notesInput,
        };

        try {
            await setDoc(recordDocRef, dataToSave, { merge: true });
            addToast("紀錄已成功儲存！", "success");
            fetchData();
        } catch (error: any) {
            addToast(`儲存失敗: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCheckInOutNow = async (type: 'checkIn' | 'checkOut') => {
        const now = new Date();
        const timeString = formatTime(now);

        if (type === 'checkIn') {
            setCheckInInput(timeString);
        } else {
            setCheckOutInput(timeString);
        }
        // 立即儲存
        await handleSave();
    };

    if (loading && !userProfile) return <p className="text-center">正在載入使用者資料...</p>;
    if (!userProfile) return <p className="text-center text-red-400">找不到 Email 為 "{userEmail}" 的使用者資料。</p>;

    return (
        <div className="max-w-md mx-auto px-4 pb-8 pt-4">
            <div className="flex justify-between items-center mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 border-2 border-accent-li text-accent-li font-bold py-2 px-4 rounded transition-colors hover:bg-gray-700"
                >
                    &larr; <span className="hidden sm:inline">返回</span>
                </button>
                <div className="text-center">
                    <h2 className="text-2xl font-bold">{userProfile.name}</h2>
                </div>
                <div className="relative">
                    <button
                        onClick={() => datePickerRef.current?.showPicker()}
                        className="border-2 border-accent-li text-accent-li font-bold py-2 px-4 rounded transition-colors hover:bg-gray-700 text-center"
                    >
                        {isToday ? "今日" : toDateString(selectedDate)}
                    </button>
                    <input
                        type="date"
                        ref={datePickerRef}
                        value={toDateString(selectedDate)}
                        onChange={(e) => setSelectedDate(new Date(e.target.value + 'T00:00:00'))}
                        className="absolute top-0 left-0 cursor-pointer opacity-0 pointer-events-none"
                    />
                </div>
            </div>

            {loading ? <div className="text-center p-8">正在載入紀錄...</div> : (
                <div className="space-y-6">
                    <div className="bg-gray-800 p-4 rounded-lg text-center flex justify-around">
                        <div>
                            <p className="text-base text-gray-400">資料庫簽到時間</p>
                            <p className="text-2xl font-mono mt-1">{formatTime(record?.checkIn) || '--:--'}</p>
                        </div>
                        <div>
                            <p className="text-base text-gray-400">資料庫簽退時間</p>
                            <p className="text-2xl font-mono mt-1">{formatTime(record?.checkOut) || '--:--'}</p>
                        </div>
                    </div>
                    <div className="flex justify-between items-center gap-4">
                        <button disabled={!!record?.checkIn} onClick={() => handleCheckInOutNow('checkIn')} className="w-full border-2 border-accent-li text-accent-li disabled:border-gray-500 disabled:text-gray-500 font-bold py-2 px-4 rounded transition-colors not-disabled:hover:bg-gray-700 ">立即簽到</button>
                        <button disabled={!record?.checkIn || !!record?.checkOut} onClick={() => handleCheckInOutNow('checkOut')} className="w-full border-2 border-accent-li text-accent-li disabled:border-gray-500 disabled:text-gray-500 font-bold py-2 px-4 rounded transition-colors not-disabled:hover:bg-gray-700">立即簽退</button>
                    </div>
                    <div className="p-4 bg-gray-800 rounded-lg space-y-4 mt-16">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">修改簽到時間</label>
                                <input type="time" value={checkInInput} onChange={e => setCheckInInput(e.target.value)} className="w-full p-2 bg-gray-700 rounded border border-gray-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">修改簽退時間</label>
                                <input type="time" value={checkOutInput} onChange={e => setCheckOutInput(e.target.value)} className="w-full p-2 bg-gray-700 rounded border border-gray-600" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">扣除時間 (分鐘)</label>
                            <input type="number" value={deductionInput} onChange={e => setDeductionInput(e.target.value)} placeholder="例如: 30" className="w-full p-2 bg-gray-700 rounded border border-gray-600" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">備註</label>
                            <textarea value={notesInput} onChange={e => setNotesInput(e.target.value)} rows={3} placeholder="例如: 事假、會議外出" className="w-full p-2 bg-gray-700 rounded border border-gray-600" />
                        </div>
                        <button onClick={handleSave} className="w-full bg-gray-700 font-bold py-2.5 px-4 rounded transition-colors hover:opacity-90">儲存修改</button>
                    </div>
                    <div className=' w-full h-32'></div>
                </div>
            )}
        </div>
    );
};

export default AdminRecordPage;