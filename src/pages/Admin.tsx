import React, { useState, useEffect, ChangeEvent } from 'react';
import { collection, query, where, getDocs, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { TimeRecord, UserProfile } from '../types';
import Papa from 'papaparse';

// --- 從舊的排名頁面來的 Type ---
interface Ranking extends UserProfile {
    totalHours: number;
}

const AdminPage = () => {
    // === 狀態管理: 使用一個 state 來控制當前顯示哪個功能頁籤 ===
    const [activeTab, setActiveTab] = useState<'rankings' | 'import' | 'manage'>('rankings');

    // === 狀態: 來自【排名】功能 ===
    const [weekStart, setWeekStart] = useState<Date>(() => {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(today.setDate(diff));
    });
    const [rankings, setRankings] = useState<Ranking[]>([]);
    const [rankingsLoading, setRankingsLoading] = useState(false);

    // === 狀態: 來自【匯入】功能 ===
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState('');
    const [importSuccess, setImportSuccess] = useState('');

    // --- 邏輯: 來自【排名】功能 ---
    useEffect(() => {
        // 只有當 "rankings" 頁籤被選中時才執行
        if (activeTab !== 'rankings') return;

        const fetchRankings = async () => {
            setRankingsLoading(true);
            // ... (省略與您提供的排名頁面完全相同的 fetchRankings 邏輯) ...
            // 以下是複製貼上的邏輯
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            const recordsRef = collection(db, 'timeRecords');
            // 注意：這裡的查詢欄位需要根據你的新資料結構調整
            // 原本是 'userId', 現在可能是 'userEmail'
            const q = query(recordsRef, where('checkIn', '>=', Timestamp.fromDate(weekStart)), where('checkIn', '<=', Timestamp.fromDate(weekEnd)));
            const recordsSnapshot = await getDocs(q);
            const weekRecords = recordsSnapshot.docs.map(doc => doc.data() as TimeRecord);

            const usersSnapshot = await getDocs(collection(db, 'users'));
            // 我們需要 email 來對應，所以建立 email -> UserProfile 的 Map
            const usersMap = new Map<string, UserProfile>();
            usersSnapshot.forEach(doc => {
                const data = doc.data();
                usersMap.set(data.email, { uid: doc.id, ...data } as UserProfile);
            });

            const userHours = new Map<string, number>();
            weekRecords.forEach(record => {
                // @ts-ignore - 'userEmail' is the new field
                const email = record.userEmail;
                if (record.checkIn && record.checkOut && email) {
                    const hours = (record.checkOut.toMillis() - record.checkIn.toMillis()) / 1000 / 60 / 60;
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
            setRankingsLoading(false);
        };

        fetchRankings();
    }, [weekStart, activeTab]); // 加入 activeTab 作為依賴項

    const handleWeekChange = (offset: number) => {
        setWeekStart(prev => {
            const newDate = new Date(prev);
            newDate.setDate(prev.getDate() + offset * 7);
            return newDate;
        });
    };

    // --- 邏輯: 來自【匯入】功能 ---
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        // ... (省略與您提供的匯入頁面完全相同的 handleFileChange 邏輯) ...
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setImportError('');
        setImportSuccess('');

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                await processCsvData(results.data);
                setImporting(false);
            },
            error: (err) => {
                setImportError(`CSV 解析失敗: ${err.message}`);
                setImporting(false);
            }
        });
    };

    const processCsvData = async (data: any[]) => {
        // ... (省略與您提供的匯入頁面完全相同的 processCsvData 邏輯) ...
        const batch = writeBatch(db);
        const usersRef = collection(db, "users");
        data.forEach(row => {
            const { studentId, email, classId, seatNo, name } = row;
            if (!studentId || !email || !name) return;
            const newUserDocRef = doc(usersRef);
            batch.set(newUserDocRef, { studentId, email: email.toLowerCase(), classId: classId || '', seatNo: seatNo || '', name, uid: null });
        });
        try {
            await batch.commit();
            setImportSuccess(`成功匯入 ${data.length} 筆初始員工資料！`);
        } catch (err: any) {
            setImportError(`寫入資料庫時發生錯誤: ${err.message}`);
        }
    };

    // --- 渲染 (Render) ---
    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl text-center mb-6">管理員儀表板</h2>

            {/* Tab 切換按鈕 */}
            <div className="flex border-b border-gray-700 mb-8">
                <button
                    onClick={() => setActiveTab('rankings')}
                    className={`py-2 px-4 ${activeTab === 'rankings' ? 'border-b-2 border-blue-400 text-white' : 'text-gray-400'}`}
                >
                    當週排名
                </button>
                <button
                    onClick={() => setActiveTab('import')}
                    className={`py-2 px-4 ${activeTab === 'import' ? 'border-b-2 border-blue-400 text-white' : 'text-gray-400'}`}
                >
                    匯入初始資料
                </button>
                <button
                    onClick={() => setActiveTab('manage')}
                    className={`py-2 px-4 ${activeTab === 'manage' ? 'border-b-2 border-blue-400 text-white' : 'text-gray-400'}`}
                >
                    管理打卡(開發中)
                </button>
            </div>

            {/* 根據 activeTab 條件渲染對應的功能區塊 */}

            {/* 排名區塊 */}
            {activeTab === 'rankings' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={() => handleWeekChange(-1)} className="p-2 border rounded">&lt; 上一週</button>
                        <span>{weekStart.toISOString().slice(0, 10)}</span>
                        <button onClick={() => handleWeekChange(1)} className="p-2 border rounded">下一週 &gt;</button>
                    </div>

                    {rankingsLoading ? <p>載入中...</p> : (
                        <ol className="list-decimal list-inside bg-gray-800 p-4 rounded">
                            {rankings.map((user) => (
                                <li key={user.uid || user.email} className="p-2 border-b border-gray-700">
                                    <span className="font-bold text-lg mr-4">{user.name}</span>
                                    <span>- 總時數: {user.totalHours.toFixed(2)} 小時</span>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            )}

            {/* 匯入區塊 */}
            {activeTab === 'import' && (
                <div className="bg-gray-800 p-6 rounded">
                    <p className="text-gray-400 mb-4">請上傳包含 `studentId`, `email`, `classId`, `seatNo`, `name` 欄位的 CSV 檔案。</p>
                    <input type="file" accept=".csv" onChange={handleFileChange} disabled={importing}
                        className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600" />
                    {importing && <p className="mt-4 text-yellow-400">正在處理檔案...</p>}
                    {importError && <p className="mt-4 text-red-400">{importError}</p>}
                    {importSuccess && <p className="mt-4 text-green-400">{importSuccess}</p>}
                </div>
            )}

            {/* 未來管理打卡紀錄的區塊 */}
            {activeTab === 'manage' && (
                <div className="text-center p-8 bg-gray-800 rounded">
                    <p>此處將放置管理員手動為員工新增、修改、刪除打卡紀錄的介面。</p>
                </div>
            )}
        </div>
    );
};

export default AdminPage;