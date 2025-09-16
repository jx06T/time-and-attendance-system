import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, setDoc, updateDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { TimeRecord, UserProfile } from '../types';

const AdminRecordPage = () => {
    const { userEmail } = useParams<{ userEmail: string }>();
    const navigate = useNavigate();

    // State for the currently selected date, defaults to today.
    const [selectedDate, setSelectedDate] = useState(new Date());

    // State for the page data
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [record, setRecord] = useState<TimeRecord | null>(null);
    const [loading, setLoading] = useState(true);

    // State for UI controls
    const [isExtraInfoExpanded, setIsExtraInfoExpanded] = useState(false);
    const [isDatePickerModalOpen, setIsDatePickerModalOpen] = useState(false);

    // State for the extra info inputs
    const [deductionInput, setDeductionInput] = useState('0');
    const [notesInput, setNotesInput] = useState('');

    // Helper function to convert a Date object to a 'YYYY-MM-DD' string
    const toDateString = (date: Date): string => date.toISOString().slice(0, 10);
    const isToday = toDateString(selectedDate) === toDateString(new Date());

    // Fetches user profile and the record for the selected date
    const fetchData = useCallback(async () => {
        if (!userEmail) {
            setLoading(false);
            return;
        }
        setLoading(true);

        const dateStr = toDateString(selectedDate);

        // Fetch user profile only once when the component loads
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

        // Fetch the time record for the selected user and date
        const recordQuery = query(collection(db, 'timeRecords'), where('userEmail', '==', userEmail), where('date', '==', dateStr));
        const recordSnapshot = await getDocs(recordQuery);

        if (!recordSnapshot.empty) {
            const recordDoc = recordSnapshot.docs[0];
            const recordData = recordDoc.data() as TimeRecord;
            setRecord({ id: recordDoc.id, ...recordData });
            setDeductionInput(String(recordData.deductionMinutes || 0));
            setNotesInput(recordData.notes || '');
        } else {
            setRecord(null);
            setDeductionInput('0');
            setNotesInput('');
        }
        setLoading(false);
    }, [userEmail, selectedDate, userProfile]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handles date selection from the modal
    const handleDateSelect = (date: Date) => {
        setSelectedDate(date);
        setIsDatePickerModalOpen(false); // Close modal after selection
    };

    // Handles check-in action
    const handleCheckIn = async () => {
        if (!userEmail) return;
        const dateStr = toDateString(selectedDate);
        const recordDocRef = doc(db, 'timeRecords', `${userEmail}_${dateStr}`);

        await setDoc(recordDocRef, {
            checkIn: Timestamp.now(),
            // Also ensure userEmail and date are set/updated
            userEmail,
            date: dateStr,
        }, { merge: true }); // Use merge to avoid overwriting extra info

        fetchData(); // Refresh data from Firestore
    };

    // Handles check-out action
    const handleCheckOut = async () => {
        if (!userEmail) return;
        const dateStr = toDateString(selectedDate);
        const recordDocRef = doc(db, 'timeRecords', `${userEmail}_${dateStr}`);
        await updateDoc(recordDocRef, { checkOut: Timestamp.now() });
        fetchData(); // Refresh data from Firestore
    };

    // Saves deduction and notes
    const handleSaveExtraInfo = async () => {
        if (!userEmail) return;

        const dateStr = toDateString(selectedDate);
        const recordDocRef = doc(db, 'timeRecords', `${userEmail}_${dateStr}`);

        const dataToSave = {
            deductionMinutes: Number(deductionInput) || 0,
            notes: notesInput,
            userEmail,
            date: dateStr,
        };

        await setDoc(recordDocRef, dataToSave, { merge: true });

        setIsExtraInfoExpanded(false); // Collapse the section after saving
        fetchData(); // Refresh data from Firestore
    };

    if (loading && !userProfile) return <p className="text-center">正在載入使用者資料...</p>;
    if (!userProfile) return <p className="text-center text-red-400">找不到 Email 為 "{userEmail}" 的使用者資料。</p>;

    return (
        <div className="max-w-md mx-auto px-4 pb-8">
            <button onClick={() => navigate(-1)} className="mb-4 text-blue-400 hover:underline">
                &larr; 返回上一頁
            </button>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">{userProfile.name}</h2>
                <button
                    onClick={() => setIsDatePickerModalOpen(true)}
                    className="text-lg text-blue-400 hover:text-blue-300 border-b border-dashed border-blue-400"
                >
                    {isToday ? "今日" : toDateString(selectedDate)}
                </button>
            </div>

            {loading ? <div className="text-center p-8">正在載入紀錄...</div> : (
                <>
                    <div className="bg-gray-800 p-6 rounded-lg text-center">
                        <div className="mb-4">
                            <p className="text-lg text-gray-400">簽到時間</p>
                            <p className="text-4xl font-mono">
                                {record?.checkIn ? record.checkIn.toDate().toLocaleTimeString() : '--:--:--'}
                            </p>
                        </div>
                        <div>
                            <p className="text-lg text-gray-400">簽退時間</p>
                            <p className="text-4xl font-mono">
                                {record?.checkOut ? record.checkOut.toDate().toLocaleTimeString() : '--:--:--'}
                            </p>
                        </div>
                        {record?.deductionMinutes && record.deductionMinutes > 0 && (
                            <p className="text-yellow-400 mt-4 pt-4 border-t border-gray-700">已扣除 {record.deductionMinutes} 分鐘</p>
                        )}
                        {record?.notes && (
                            <p className="text-gray-300 mt-2 text-sm">備註: {record.notes}</p>
                        )}
                    </div>

                    <div className="mt-8 flex justify-around">
                        <button
                            onClick={handleCheckIn}
                            disabled={!!record?.checkIn}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg"
                        >
                            簽到
                        </button>
                        <button
                            onClick={handleCheckOut}
                            disabled={!record?.checkIn || !!record?.checkOut}
                            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg"
                        >
                            簽退
                        </button>
                    </div>
                </>
            )}

            <div className="mt-12 pt-8 border-t border-gray-700">
                <button
                    onClick={() => setIsExtraInfoExpanded(!isExtraInfoExpanded)}
                    className="w-full flex justify-between items-center text-left text-yellow-400 hover:text-yellow-300 font-bold text-lg"
                >
                    <span>扣除時間 / 備註</span>
                    <span className={`transform transition-transform duration-200 ${isExtraInfoExpanded ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {isExtraInfoExpanded && (
                    <div className="mt-4 p-4 bg-gray-800 rounded-lg animate-fade-in">
                        <div className="mb-4">
                            <label htmlFor="deduction" className="block text-sm font-medium text-gray-400 mb-1">
                                扣除時間 (分鐘)
                            </label>
                            <input
                                type="number"
                                id="deduction"
                                value={deductionInput}
                                onChange={(e) => setDeductionInput(e.target.value)}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                                placeholder="例如: 30"
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="notes" className="block text-sm font-medium text-gray-400 mb-1">
                                備註 (例如: 事假、會議外出)
                            </label>
                            <textarea
                                id="notes"
                                value={notesInput}
                                onChange={(e) => setNotesInput(e.target.value)}
                                rows={3}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                            />
                        </div>
                        <div className="text-right">
                            <button onClick={handleSaveExtraInfo} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                                儲存額外資訊
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {isDatePickerModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-gray-800 p-6 rounded-lg w-full max-w-sm">
                        <h3 className="text-xl font-bold mb-4">選擇操作日期</h3>
                        <input
                            type="date"
                            defaultValue={toDateString(selectedDate)}
                            onChange={(e) => handleDateSelect(new Date(e.target.value + 'T00:00:00'))}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white mb-4"
                        />
                        <div className="flex justify-around mt-2">
                            <button onClick={() => handleDateSelect(new Date())} className="text-blue-400 hover:underline">回到今天</button>
                        </div>
                        <div className="text-right mt-6">
                            <button onClick={() => setIsDatePickerModalOpen(false)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded">
                                關閉
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminRecordPage;
