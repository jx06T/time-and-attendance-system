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
interface CachedActionDetail {
    timestamp: number;
    userName: string;
}
interface CachedAction {
    checkIn?: CachedActionDetail;
    checkOut?: CachedActionDetail;
}
type CachedActions = Record<string, CachedAction>; // Key 是 user.email

function BatchRecordPage() {
    const { allUsers, pendingEmails, checkedOutTodayEmails, loading: usersLoading, fetchUsers } = useUsers();
    const { user: adminUser } = useAuth();
    const { addToast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

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

    const handleLocalCheckInOut = useCallback((user: UserProfile, actionType: 'checkIn' | 'checkOut') => {
        setCachedActions(prev => {
            const newActions = { ...prev };
            const existingUserActions = { ...(newActions[user.email] || {}) };

            // 檢查是否是取消操作
            if (existingUserActions[actionType]) {
                if (actionType === "checkIn") {
                    delete existingUserActions["checkOut"];
                }
                delete existingUserActions[actionType];
            } else {
                // 否則，是新增操作
                existingUserActions[actionType] = {
                    timestamp: Date.now(),
                    userName: user.name,
                };
            }

            if (Object.keys(existingUserActions).length === 0) {
                delete newActions[user.email];
            } else {
                newActions[user.email] = existingUserActions;
            }

            return newActions;
        });
    }, [setCachedActions]);

    const handleSync = async () => {
        if (cachedActionCount === 0 || isSyncing || !adminUser) return;
        setIsSyncing(true);
        const batch = writeBatch(db);
        const dateStr = toLocalDateString(new Date());

        try {
            for (const email in cachedActions) {
                const actionData = cachedActions[email];
                const recordDocRef = doc(db, 'timeRecords', `${email}_${dateStr}`);

                const dataToSync: any = {};

                if (actionData.checkIn) {
                    dataToSync.userEmail = email;
                    dataToSync.date = dateStr;
                    dataToSync.checkIn = Timestamp.fromMillis(actionData.checkIn.timestamp);
                    dataToSync.checkInRecorderUid = adminUser.uid;
                    // 確保 checkOut 為 null，以防這是一個全新的記錄
                    if (!actionData.checkOut) {
                        dataToSync.checkOut = null;
                        dataToSync.checkOutRecorderUid = null;
                    }
                }

                if (actionData.checkOut) {
                    dataToSync.checkOut = Timestamp.fromMillis(actionData.checkOut.timestamp);
                    dataToSync.checkOutRecorderUid = adminUser.uid;
                }

                // 使用 set with merge，可以安全地創建新紀錄或更新現有紀錄
                if (Object.keys(dataToSync).length > 0) {
                    batch.set(recordDocRef, dataToSync, { merge: true });
                }
            }

            await batch.commit();
            addToast(`成功同步 ${cachedActionCount} 筆用戶記錄！`, "success", 5000);
            setCachedActions({});
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
        <div className="">
            <div className="bg-gray-800 p-6 pb-8 rounded-lg ">
                <div className=' grid grid-cols-[0.6fr_1fr]  mb-4 h-18'>
                    <h3 className="text-xl font-bold">批量打卡</h3>
                    {cachedActionCount > 0 && (
                        <div className=" text-right">
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className="px-4 pt-2 py-1 border-2 bg-gray-800 border-accent-li  text-accent-li font-bold rounded disabled:cursor-wait cursor-pointer"
                            >
                                {isSyncing ? (
                                    <>
                                        <CiLoading className="animate-spin text-2xl inline-block" />
                                        <span>同步中...</span>
                                    </>
                                ) : (
                                    <>
                                        <IcRoundSync className="text-2xl inline-block mb-1 mr-0.5" />
                                        <span>同步 {cachedActionCount} 筆變更</span>
                                    </>
                                )}
                            </button>
                            <span className=' block mt-1 text-right w-full cursor-pointer text-gray-400 underline underline-offset-2' onClick={handleClearCache}>清除緩存</span>
                        </div>
                    )}
                </div>
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

                                        // 結合伺服器和本地緩存的狀態來決定最終狀態
                                        const hasServerCheckIn = pendingEmails.has(user.email) || checkedOutTodayEmails.has(user.email);
                                        const hasServerCheckOut = checkedOutTodayEmails.has(user.email);

                                        const effectiveCheckIn = cachedAction?.checkIn || hasServerCheckIn;
                                        const effectiveCheckOut = cachedAction?.checkOut || hasServerCheckOut;

                                        // 如果本地取消了簽到，但還留著簽退，這是不合邏輯的，簽退也應被視為無效
                                        const logicalCheckOut = effectiveCheckIn && effectiveCheckOut;

                                        const checkInDisabled = !!effectiveCheckIn;
                                        const checkOutDisabled = !effectiveCheckIn || !!logicalCheckOut;

                                        // 判斷是否高亮：如果本地緩存的簽到/簽退狀態與按鈕的禁用狀態不符，則表示有待辦事項
                                        const isCheckInPending = cachedAction?.checkIn && !hasServerCheckIn;
                                        const isCheckOutPending = cachedAction?.checkOut && !hasServerCheckOut;
                                        // 或者，取消了一個已存在伺服器的操作
                                        const isCheckInCancelled = cachedAction && !cachedAction.checkIn && hasServerCheckIn && !hasServerCheckOut;
                                        const isCheckOutCancelled = cachedAction && !cachedAction.checkOut && hasServerCheckOut;

                                        const hasPendingChange = isCheckInPending || isCheckOutPending || isCheckInCancelled || isCheckOutCancelled;

                                        return (
                                            <tr key={user.id} className={`not-last:border-b border-gray-700 ${hasPendingChange ? 'bg-accent/30' : ''}`}>
                                                <td className="p-3 px-4 font-mono">{user.classId} {user.seatNo}</td>
                                                <td className="p-3 px-4 font-bold text-base">{user.name}</td>
                                                <td className="p-3 px-4">
                                                    <div className="flex justify-center items-center gap-2">
                                                        <button
                                                            onClick={() => handleLocalCheckInOut(user, 'checkIn')}
                                                            // disabled={!checkOutDisabled}
                                                            className={`px-3 py-1 border-2 rounded transition-colors ${checkInDisabled ? "border-gray-600 text-gray-400 opacity-50 cursor-not-allowed" : "border-accent-li text-accent-li"}`}
                                                        >
                                                            簽到
                                                        </button>
                                                        <button
                                                            onClick={() => handleLocalCheckInOut(user, 'checkOut')}
                                                            disabled={!checkInDisabled}
                                                            className={`px-3 py-1 border-2 rounded transition-colors ${checkOutDisabled ? "border-gray-600 text-gray-400 opacity-50 cursor-not-allowed" : "border-accent-li text-accent-li"}`}
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


            <div className='w-full h-4 bg-transparent'></div>
        </div>
    );
}

export default BatchRecordPage;