import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { TimeRecord, UserProfile } from '../types';

import NumericKeypad from '../components/NumericKeypad';
import QRCodeScannerModal from '../components/QRCodeScannerModal';
import { formatTime, toLocalDateString } from '../utils/tools'

import { useToast } from '../hooks/useToast';
import { useUsers } from '../context/UsersContext';
import { createConfirmDialog } from '../utils/createConfirmDialog';

import { useAuth } from '../context/AuthContext';
import { StreamlineScannerSolid, CiLoading, IcRoundSync } from '../assets/Icons';

const AdminHomePage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [input, setInput] = useState('');

  const [loading, setLoading] = useState(false);
  const { allUsers, fetchUsers, lastUpdated } = useUsers();

  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const processingRef = useRef(false);

  const { user: adminUser } = useAuth();

  const handleUpdateUsers = async () => {
    setLoading(true);
    try {
      fetchUsers()
      // addToast("使用者列表已更新！", "success");
    } catch (error: any) {
      console.error("更新使用者列表失敗:", error);
      addToast(`更新使用者列表失敗: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!input) {
      return allUsers;
    }
    const cleanedSearchTerm = input.trim().toLowerCase();

    return allUsers.filter(user =>
      user.classId.toLowerCase().includes(cleanedSearchTerm) ||
      user.name.toLowerCase().includes(cleanedSearchTerm) ||
      user.email.toLowerCase().includes(cleanedSearchTerm) ||
      user.seatNo.toLowerCase().includes(cleanedSearchTerm) ||
      `${user.classId}${user.seatNo}`.startsWith(cleanedSearchTerm)
    );
  }, [input, allUsers]);

  const handleConfirm = () => {
    if (filteredUsers.length === 1) {
      navigate(`/admin/record/${filteredUsers[0].email}`);
    } else {
      if (filteredUsers.length === 0) {
        addToast("無使用者符合條件", "error");
      } else {
        addToast("有多位使用者符合條件", "error");
      }
    }
  };

  // ================================================================

  const handleScanSuccess = useCallback(async (scannedText: string) => {
    if (processingRef.current) {
      return
    }
    processingRef.current = true;
    // setIsScannerOpen(false);

    let scannedEmail: string | null = null;

    try {
      const url = new URL(scannedText);

      const parts = url.pathname.split("/");
      if (parts[1] === "r"  && parts.length >= 3) {
        scannedEmail = parts[3];
      }
    } catch (e) {
    }
    if (!scannedEmail) {
      addToast("URL 資料格式錯誤", "error");
      setTimeout(() => {
        processingRef.current = false
      }, 1000);
      return
    }

    const targetUser = allUsers.find(u => u.email === scannedEmail);

    if (!targetUser) {
      addToast(`錯誤：找不到 Email 為 "${scannedEmail}" 的使用者`, "error");
      setTimeout(() => {
        processingRef.current = false;
      }, 1000);
      return;
    }

    try {
      const dateStr = toLocalDateString(new Date());
      const recordQuery = query(collection(db, 'timeRecords'), where('userEmail', '==', scannedEmail), where('date', '==', dateStr));
      const recordSnapshot = await getDocs(recordQuery);

      let action: 'checkIn' | 'checkOut';
      let existingRecord: TimeRecord | undefined;

      if (recordSnapshot.empty) {
        action = 'checkIn';
      } else {
        const recordDoc = recordSnapshot.docs[0];
        existingRecord = { id: recordDoc.id, ...recordDoc.data() } as TimeRecord;

        if (existingRecord.checkIn && !existingRecord.checkOut) {
          action = 'checkOut';
        } else {
          createConfirmDialog({
            title: `${targetUser.name} 已經簽退`,
            message:
              `班級座號：${targetUser.classId}  ${targetUser.seatNo}\n` +
              `簽到時間：${formatTime(existingRecord?.checkIn)}\n` +
              `簽退時間：${formatTime(existingRecord?.checkOut)}`,
            confirmText: "確認",
            cancelText:"查看詳情",
            onConfirm: () => {
              processingRef.current = false;
            },
            onCancel: () => {
              processingRef.current = false;
              navigate("/admin/record/"+scannedEmail)
            }
          });

          return;
        }
      }

      createConfirmDialog({
        title: `確認 ${targetUser.name} ${action === 'checkIn' ? '簽到' : '簽退'}？`,
        message:
          `班級座號：${targetUser.classId}  ${targetUser.seatNo}\n` +
          `簽到時間：${action === 'checkIn' ? `現在（ ${formatTime(Timestamp.now())} ）` : formatTime(existingRecord?.checkIn)}\n` +
          `簽退時間：${action === 'checkOut' ? `現在（ ${formatTime(Timestamp.now())} ）` : 'N/A'}`,
        confirmText: `確認${action === 'checkIn' ? '簽到' : '簽退'}`,
        onConfirm: async () => {
          processingRef.current = false;
          if (!adminUser) return;

          const recordDocRef = doc(db, 'timeRecords', `${targetUser.email}_${dateStr}`);
          const nowTimestamp = Timestamp.now();

          try {
            if (action === 'checkIn') {
              await setDoc(recordDocRef, { checkIn: nowTimestamp, userEmail: targetUser.email, date: dateStr, checkInRecorderUid: adminUser.uid }, { merge: true });
              addToast(`${targetUser.name} 簽到成功！`, "success");
            } else {
              await setDoc(recordDocRef, { checkOut: nowTimestamp, checkOutRecorderUid: adminUser.uid }, { merge: true });
              addToast(`${targetUser.name} 簽退成功！`, "success");
            }
          } catch (error: any) {
            addToast(`操作失敗: ${error.message}`, 'error');
          }
        },
        onCancel: () => {
          processingRef.current = false;
          addToast("操作已取消");
        }
      });

    } catch (error: any) {
      addToast(`查詢紀錄失敗: ${error.message}`, "error");
    } finally {
    }
  }, [allUsers, addToast, adminUser])

  const handleScanError = useCallback((errorMessage: string) => {
    if (errorMessage.includes("NotAllowedError") || errorMessage.includes("Permission denied")) {
      processingRef.current = false;
      setIsScannerOpen(false);
      addToast("相機權限已被拒絕。請在瀏覽器設定中允許本網站使用相機。", "error");
    }
  }, [addToast]);

  // ================================================================

  useEffect(() => {
    document.title = '場佈打卡系統 | 打卡頁面';
    return () => {
      document.title = '場佈打卡系統';
    };
  }, []);

  return (
    <div className="flex flex-col items-center w-full pt-8 px-3">
      <div className=' w-full max-w-md mb-10'>
        <div className="w-full p-3.5 bg-gray-700 rounded-md mb-4 text-center h-14 text-xl">
          {input || '使用下方數字鍵盤輸入班級座號'}
        </div>

        <NumericKeypad
          onInput={(val) => setInput(prev => prev + val)}
          onDelete={() => setInput(prev => prev.slice(0, -1))}
          onClear={() => setInput('')}
          onConfirm={handleConfirm}
        />
      </div>

      <div className="w-full max-w-md mb-4 flex-grow max-h-96 overflow-y-auto">
        {loading && allUsers.length === 0 ? (
          <p className="text-center text-gray-500 mt-8">正在載入使用者資料...</p>
        ) : filteredUsers.length > 0 ? (
          <ul className="space-y-3">
            {filteredUsers.map(user => (
              <li key={user.id}
                onClick={() => navigate(`/admin/record/${user.email}`)}
                className="p-3 px-5 bg-gray-800 rounded flex justify-between items-center cursor-pointer hover:bg-gray-700 transition-colors"
              >
                <div>
                  <p className="text-base text-gray-400  font-mono">{user.classId} {user.seatNo}</p>
                  <p className="font-bold text-xl text-neutral">{user.name}</p>
                </div>
                <span className="text-accent-li text-2xl font-bold">&rarr;</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-gray-500 mt-8">
            {input ? '沒有匹配結果' : '請嘗試手動更新使用者資料'}
          </p>
        )}
      </div>

      <div className="w-full max-w-md px-0 md:px-2 flex items-start gap-2 md:gap-6 mt-2 ">
        <input
          type="text"
          placeholder="輸入姓名搜尋"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full sm:w-auto flex-grow p-2 bg-gray-700 border border-gray-600 rounded text-white"
        />
        <button
          onClick={() => setIsScannerOpen(true)}
          className=" inline-block border-2 border-accent-li bg-gray-800 h-11 w-12 rounded 
                                   hover:bg-gray-700 text-neutral 
                                   transition-colors duration-200 
                                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <StreamlineScannerSolid className=' inline-block mb-1 text-lg' />
        </button>
        <button
          onClick={handleUpdateUsers}
          disabled={loading}
          className=" inline-block border-2 border-accent-li bg-gray-800 h-11 w-12 rounded 
                                   hover:bg-gray-700 text-neutral 
                                   transition-colors duration-200 
                                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <CiLoading className=' inline-block text-2xl' /> : <IcRoundSync className=' inline-block text-2xl' />}
        </button>
      </div>
      {lastUpdated && (
        <p className="text-xs text-gray-400 mt-2 text-center tracking-wide">
          使用者列表上次更新於: {new Date(lastUpdated).toLocaleString()}
        </p>
      )}

      <QRCodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => {
          processingRef.current = false;
          setIsScannerOpen(false)
        }}
        onScanSuccess={handleScanSuccess}
        onScanError={handleScanError}
      />
      <div className=' w-full h-32'></div>
    </div>
  );
};

export default AdminHomePage;