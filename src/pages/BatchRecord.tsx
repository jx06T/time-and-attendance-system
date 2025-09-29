import { useState, useMemo, useCallback, useEffect } from 'react';
import { doc, setDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { useUsers } from '../context/UsersContext';
import { useAuth } from '../context/AuthContext';

import { useToast } from '../hooks/useToast';
import { createConfirmDialog } from '../utils/createConfirmDialog';

import { toLocalDateString } from '../utils/tools';
import { CiLoading, IcRoundSync } from '../assets/Icons';
import useLocalStorage from '../hooks/useLocalStorage'; // 引入您的 useLocalStorage hook

// 定義緩存操作的類型
interface CachedAction {
    action: 'checkIn' | 'checkOut';
    timestamp: number; // 存儲為數字以便 JSON 序列化
    userName: string;
}

type CachedActions = Record<string, CachedAction>; // Key 是 user.email

function BatchRecordPage() {
    const { allUsers, pendingEmails, checkedOutTodayEmails, loading: usersLoading, fetchUsers } = useUsers();
    const { user: adminUser } = useAuth();
    const { addToast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    // 1. 使用 useLocalStorage hook 來管理待處理的操作
    const [cachedActions, setCachedActions] = useLocalStorage<CachedActions>('batch-record-actions', {});
    const cachedActionCount = Object.keys(cachedActions).length;

    const filteredAndSortedUsers = useMemo(() => {
        const cleanedInput = searchTerm.trim().toLowerCase();
        let filtered = allUsers;

        if (cleanedInput) {
            filtered = allUsers.filter(user =>
                user.name.toLowerCase().includes(cleanedInput) ||
                user.classId.toLowerCase().includes(cleanedInput) ||
                user.seatNo.toLowerCase().includes(cleanedInput) ||
                `${user.classId}${user.seatNo}`.startsWith(cleanedInput)
            );
        }

        return filtered.sort((a, b) => {
            const aId = `${a.classId}${a.seatNo}`;
            const bId = `${b.classId}${b.seatNo}`;
            return aId.localeCompare(bId);
        });
    }, [searchTerm, allUsers]);

    // 2. 修改 handleCheckInOut，使其只更新本地緩存
    const handleLocalCheckInOut = useCallback((user: UserProfile, action: 'checkIn' | 'checkOut') => {
        setCachedActions(prev => ({
            ...prev,
            [user.email]: {
                action,
                timestamp: Date.now(),
                userName: user.name,
            }
        }));
    }, [setCachedActions]);

    // 3. 創建一個新的異步函數來處理與 Firebase 的同步
    const handleSync = async () => {
        if (cachedActionCount === 0 || isSyncing || !adminUser) {
            return;
        }

        setIsSyncing(true);
        const batch = writeBatch(db);
        const dateStr = toLocalDateString(new Date());

        try {
            for (const email in cachedActions) {
                const actionData = cachedActions[email];
                const recordDocRef = doc(db, 'timeRecords', `${email}_${dateStr}`);
                const timestamp = Timestamp.fromMillis(actionData.timestamp);

                if (actionData.action === 'checkIn') {
                    batch.set(recordDocRef, {
                        userEmail: email,
                        date: dateStr,
                        checkIn: timestamp,
                        checkInRecorderUid: adminUser.uid,
                        checkOut: null,
                        checkOutRecorderUid: null,
                    }, { merge: true });
                } else {
                    batch.update(recordDocRef, {
                        checkOut: timestamp,
                        checkOutRecorderUid: adminUser.uid,
                    });
                }
            }

            await batch.commit();
            addToast(`成功同步 ${cachedActionCount} 筆記錄！`, "success", 5000);
            setCachedActions({}); // 清空本地緩存
            // await fetchUsers(); // 從伺服器獲取最新狀態

        } catch (error: any) {
            console.error("同步失敗：", error);
            addToast(`同步失敗： ${error.message}`, 'error', 10000);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleClearCache = () => {
        createConfirmDialog({
            title: "確認要清除緩存？",
            message: `清除 ${cachedActionCount} 筆變更紀錄，此動作無法復原`,
            confirmText: "清除",
            cancelText: "取消",
            onConfirm: () => {
                setCachedActions({});
                addToast("已清除所有待同步操作。", "error");
            }
        })
    };

    return (
        <div className="relative">
            <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">批量打卡</h3>
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="搜尋姓名、班級、座號..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                    />
                </div>

                {usersLoading ? (
                    <p className="text-center py-10">使用者資料載入中...</p>
                ) : (
                    <div className="overflow-x-auto max-h-[65vh] bg-gray-900 rounded">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-700 sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 px-4">班級座號</th>
                                    <th className="p-3 px-4">姓名</th>
                                    <th className="p-3 px-4 text-center">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAndSortedUsers.length > 0 ? (
                                    filteredAndSortedUsers.map(user => {
                                        const cachedAction = cachedActions[user.email];
                                        const isPendingOnServer = pendingEmails.has(user.email);
                                        const hasCheckedOutToday = checkedOutTodayEmails.has(user.email); // <-- 使用新數據

                                        let checkInDisabled = false;
                                        let checkOutDisabled = false;

                                        if (cachedAction) {
                                            // 本地有緩存，優先以緩存狀態為準
                                            if (cachedAction.action === 'checkIn') {
                                                checkInDisabled = true;
                                                checkOutDisabled = false;
                                            } else { // cachedAction.action === 'checkOut'
                                                checkInDisabled = true;
                                                checkOutDisabled = true;
                                            }
                                        } else {
                                            // 沒有本地緩存，依賴伺服器狀態
                                            if (hasCheckedOutToday) {
                                                checkInDisabled = true;
                                                checkOutDisabled = true;
                                            } else if (isPendingOnServer) {
                                                checkInDisabled = true;
                                                checkOutDisabled = false;
                                            } else {
                                                checkInDisabled = false;
                                                checkOutDisabled = true;
                                            }
                                        }

                                        return (
                                            <tr key={user.id} className={`not-last:border-b border-gray-700 ${cachedAction ? 'bg-accent/10' : ''}`}>
                                                <td className="p-3 px-4 font-mono">{user.classId} {user.seatNo}</td>
                                                <td className="p-3 px-4 font-bold text-base">{user.name}</td>
                                                <td className="p-3 px-4">
                                                    <div className="flex justify-center items-center gap-2">
                                                        <button
                                                            onClick={() => handleLocalCheckInOut(user, 'checkIn')}
                                                            disabled={checkInDisabled}
                                                            className="-z-0 px-3 py-1 border-2 border-accent-li rounded text-accent-li disabled:border-gray-600 disabled:text-gray-400 disabled:opacity-50 transition-colors"
                                                        >
                                                            簽到
                                                        </button>
                                                        <button
                                                            onClick={() => handleLocalCheckInOut(user, 'checkOut')}
                                                            disabled={checkOutDisabled}
                                                            className="-z-0 px-3 py-1 border-2 border-accent-li rounded text-accent-li disabled:border-gray-600 disabled:text-gray-400 disabled:opacity-50 transition-colors"
                                                        >
                                                            簽退
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="text-center p-8 text-gray-500">
                                            {searchTerm ? '沒有符合的使用者' : '沒有使用者資料'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {cachedActionCount > 0 && (
                <div className="fixed bottom-4 right-8 z-50">
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex items-center gap-1 px-4 py-2 border-2 bg-gray-800 border-accent-li  text-accent-li font-bold rounded disabled:cursor-wait cursor-pointer"
                    >
                        {isSyncing ? (
                            <>
                                <CiLoading className="animate-spin text-2xl" />
                                <span>同步中...</span>
                            </>
                        ) : (
                            <>
                                <IcRoundSync className="text-2xl" />
                                <span>同步 {cachedActionCount} 筆變更</span>
                            </>
                        )}
                    </button>
                    <span className=' block mt-1 text-right w-full cursor-pointer text-gray-400 underline underline-offset-2' onClick={handleClearCache}>清除緩存</span>
                </div>
            )}
            <div className='w-full h-32 bg-transparent'></div>
        </div>
    );
}

export default BatchRecordPage;