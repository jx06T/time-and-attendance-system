import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import useLocalStorage from '../hooks/useLocalStorage'; // 引入我們建立的自訂 Hook

const AdminHomePage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // 使用 useLocalStorage Hook 來自動同步 state 和 localStorage
  const [allUsers, setAllUsers] = useLocalStorage<UserProfile[]>('allUsers', []);
  const [lastUpdated, setLastUpdated] = useLocalStorage<string | null>('usersLastUpdated', null);

  // 從 Firestore 獲取最新資料並更新 state 和 localStorage 的函式
  const handleUpdateUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const users = querySnapshot.docs.map(doc => {
        // 確保返回的物件符合 UserProfile 型別
        const data = doc.data();
        return {
          id: doc.id,
          uid: data.uid,
          name: data.name,
          classId: data.classId,
          seatNo: data.seatNo,
          email: data.email,
          studentId: data.studentId,
        };
      });

      const now = new Date();
      // 直接呼叫 Hook 返回的 setValue 函式，它會自動處理 state 更新和 localStorage 寫入
      setAllUsers(users);
      setLastUpdated(now.toISOString());

    } catch (error) {
      console.error("更新使用者列表失敗:", error);
      // 可以在此添加 UI 上的錯誤提示
    } finally {
      setLoading(false);
    }
  };

  // 使用 useMemo 進行客戶端篩選，以優化性能
  const filteredUsers = useMemo(() => {
    // Trim 掉使用者輸入的前後空白
    const cleanedSearchTerm = searchTerm.trim().toLowerCase();

    if (!cleanedSearchTerm) {
      return allUsers; // 如果沒有輸入，顯示所有人
    }
    return allUsers.filter(user =>
      // 進行不分大小寫的比對
      user.classId.toLowerCase().includes(cleanedSearchTerm) ||
      user.name.toLowerCase().includes(cleanedSearchTerm) ||
      user.seatNo.toLowerCase().includes(cleanedSearchTerm)
    );
  }, [searchTerm, allUsers]);


  return (
    <div className="flex flex-col items-center w-full px-4">
      <h2 className="text-2xl mb-4">管理員操作面板</h2>

      {/* 更新和篩選區域 */}
      <div className="w-full max-w-lg p-4 border border-gray-700 bg-gray-800 rounded mb-4 flex flex-col sm:flex-row items-center gap-4">
        <input
          type="text"
          placeholder="輸入班級、姓名或座號進行篩選..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-auto flex-grow p-2 bg-gray-700 border border-gray-600 rounded text-white"
        />
        <button
          onClick={handleUpdateUsers}
          disabled={loading}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '更新中...' : '手動更新列表'}
        </button>
      </div>
      {lastUpdated && (
        <p className="text-sm text-gray-400 mb-4">
          列表上次更新於: {new Date(lastUpdated).toLocaleString()}
        </p>
      )}

      {/* 使用者列表 */}
      <div className="w-full max-w-lg">
        {loading && allUsers.length === 0 ? (
          <p className="text-center text-gray-500 mt-8">正在從伺服器載入使用者列表...</p>
        ) : filteredUsers.length > 0 ? (
          <ul className="space-y-2">
            {filteredUsers.map(user => (
              <li key={user.id}
                onClick={() => navigate(`/admin/record/${user.email}`)}
                className="p-3 bg-gray-800 rounded flex justify-between items-center cursor-pointer hover:bg-gray-700 transition-colors"
              >
                <div>
                  <p className="font-bold text-white">{user.name}</p>
                  <p className="text-sm text-gray-400">班級: {user.classId} - 座號: {user.seatNo}</p>
                </div>
                <span className="text-blue-400 text-2xl font-thin">&rarr;</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-gray-500 mt-8">
            {allUsers.length > 0 ? '沒有匹配的結果。' : '本地沒有使用者資料，請點擊“手動更新列表”從伺服器載入。'}
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminHomePage;