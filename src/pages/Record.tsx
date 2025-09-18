import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, setDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { TimeRecord, UserProfile, UserRole } from '../types';
import { useToast } from '../hooks/useToast';
import { formatTime } from '../utils/tools'
import { useAuth } from '../context/AuthContext';

const AdminRecordPage = () => {
    const { userEmail } = useParams<{ userEmail: string }>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const datePickerRef = useRef<HTMLInputElement>(null);

    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [record, setRecord] = useState<TimeRecord | null>(null);
    const [loading, setLoading] = useState(true);

    const [checkInInput, setCheckInInput] = useState('');
    const [checkOutInput, setCheckOutInput] = useState('');
    const [deductionInput, setDeductionInput] = useState('0');
    const [notesInput, setNotesInput] = useState('');

    const { user, role } = useAuth();

    const [searchParams, setSearchParams] = useSearchParams();

    const [selectedDate, setSelectedDate] = useState<Date>(() => {
        const dateParam = searchParams.get('date');
        if ((role === UserRole.Admin || role === UserRole.SuperAdmin) && dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
            return new Date(dateParam + 'T00:00:00');
        }
        return new Date();
    });

    useEffect(() => {
        const dateStr = toLocalDateString(selectedDate);

        if (searchParams.get('date') !== dateStr) {
            setSearchParams({ date: dateStr });
        }
    }, [selectedDate, searchParams, setSearchParams]);

    const toLocalDateString = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    };
    const isToday = toLocalDateString(selectedDate) === toLocalDateString(new Date());

    const fetchData = useCallback(async () => {
        if (!userEmail) {
            setLoading(false);
            return;
        }
        setLoading(true);

        const dateStr = toLocalDateString(selectedDate);

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

    const handleSaveAllChanges = async () => {
        if (!userEmail) return;
        setLoading(true);
        const dateStr = toLocalDateString(selectedDate);
        const recordDocRef = doc(db, 'timeRecords', `${userEmail}_${dateStr}`);

        const getTimestamp = (timeStr: string): Timestamp | null | undefined => {
            if (!/^\d{2}(:\d{2})?$/.test(timeStr)) {
                if (timeStr === '') return null;
                // addToast(`時間格式錯誤: ${timeStr}，應為 HH:mm`, 'error');
                return undefined;
            }
            const parts = timeStr.split(':');
            const hours = Number(parts[0]);
            const minutes = Number(parts[1]);
            const date = new Date(selectedDate);
            date.setHours(hours, minutes, 0, 0);
            return Timestamp.fromDate(date);
        };

        const checkInTimestamp = getTimestamp(checkInInput);
        const checkOutTimestamp = getTimestamp(checkOutInput);

        const dataToSave: Partial<TimeRecord> = {
            userEmail,
            date: dateStr,
            deductionMinutes: Number(deductionInput) || 0,
            notes: notesInput,
            checkInRecorderUid: user?.uid,
            checkOutRecorderUid: user?.uid,
        };

        if (checkInTimestamp !== undefined) dataToSave.checkIn = checkInTimestamp;
        if (checkOutTimestamp !== undefined) dataToSave.checkOut = checkOutTimestamp;

        try {
            await setDoc(recordDocRef, dataToSave, { merge: true });
            addToast("紀錄已保存！", "success");
            fetchData();
        } catch (error: any) {
            addToast(`儲存失敗: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCheckInOutNow = async (type: 'checkIn' | 'checkOut') => {
        if (!userEmail) return;
        setLoading(true);

        const dateStr = toLocalDateString(selectedDate);
        const recordDocRef = doc(db, 'timeRecords', `${userEmail}_${dateStr}`);
        const nowTimestamp = Timestamp.now();

        try {
            if (type === 'checkIn') {
                await setDoc(recordDocRef, {
                    checkIn: nowTimestamp,
                    userEmail,
                    date: dateStr,
                    checkInRecorderUid: user?.uid,
                }, { merge: true });
                addToast("簽到成功！", "success");
            } else {
                await setDoc(recordDocRef, {
                    checkOut: nowTimestamp,
                    userEmail,
                    date: dateStr,
                    checkOutRecorderUid: user?.uid,
                }, { merge: true });
                addToast("簽退成功！", "success");
            }
            await fetchData();
        } catch (error: any) {
            addToast(`操作失敗: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !userProfile) return <p className="text-center">正在載入使用者資料...</p>;
    if (!userProfile) return <p className="text-center text-red-400">找不到 Email 為 "{userEmail}" 的使用者資料。</p>;

    return (
        <div className=' px-3 pt-6 w-full flex flex-col items-center '>
            <div className="max-w-md w-full">
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
                    <div className="relative overflow-hidden">
                        <button
                            onClick={() => {
                                datePickerRef.current?.showPicker();
                            }}
                            className="border-2 border-accent-li text-accent-li font-bold py-2 px-4 rounded transition-colors hover:bg-gray-700 text-center"
                        >
                            {isToday ? "今日" : toLocalDateString(selectedDate)}
                        </button>
                        {(role === UserRole.Admin || role === UserRole.SuperAdmin) &&
                            <input
                                onClick={() => {
                                    datePickerRef.current?.showPicker();
                                }}
                                type="date"
                                ref={datePickerRef}
                                value={toLocalDateString(selectedDate)}
                                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                                className="absolute top-0 left-0 right-0 bottom-0 opacity-0 z-10 bg-red-50"
                            />
                        }
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
                        {(role === UserRole.Admin || role === UserRole.SuperAdmin) &&
                            <div className="p-4 bg-gray-800 rounded-lg space-y-4 mt-16">
                                <div className="grid grid-cols-2 gap-4 overflow-hidden">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">修改簽到時間</label>
                                        <input type="time" value={checkInInput} onChange={e => setCheckInInput(e.target.value)} className="w-full inline-block p-2 bg-gray-700 rounded border border-gray-600" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">修改簽退時間</label>
                                        <input type="time" value={checkOutInput} onChange={e => setCheckOutInput(e.target.value)} className="w-full inline-block p-2 bg-gray-700 rounded border border-gray-600" />
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
                                <button onClick={handleSaveAllChanges} className="w-full bg-gray-700 font-bold py-2.5 px-4 rounded transition-colors hover:opacity-90">儲存修改</button>
                            </div>
                        }
                        <div className=' w-full h-32'></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminRecordPage;