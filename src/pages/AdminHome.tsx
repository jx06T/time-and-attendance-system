import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import NumericKeypad from '../components/NumericKeypad';
import { useToast } from '../hooks/useToast';

const AdminHomePage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [input, setInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useLocalStorage<UserProfile[]>('allUsers', []);
  const [lastUpdated, setLastUpdated] = useLocalStorage<string | null>('usersLastUpdated', null);

  const handleUpdateUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setAllUsers(users);
      setLastUpdated(new Date().toISOString());
      addToast("使用者列表已更新！", "success");
    } catch (error: any) {
      console.error("更新使用者列表失败:", error);
      addToast(`更新使用者列表失败: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!input) {
      return allUsers;
    }

    // return allUsers.filter(user => {
    //   const combinedId = `${user.classId}${user.seatNo}`;
    //   return combinedId.startsWith(input);
    // });

    const cleanedSearchTerm = input.trim().toLowerCase();

    return allUsers.filter(user =>
      user.classId.toLowerCase().includes(cleanedSearchTerm) ||
      user.name.toLowerCase().includes(cleanedSearchTerm) ||
      user.seatNo.toLowerCase().includes(cleanedSearchTerm) ||
      `${user.classId}${user.seatNo}`.startsWith(cleanedSearchTerm)
    );
  }, [input, allUsers]);

  const handleConfirm = () => {
    if (filteredUsers.length === 1) {
      navigate(`/admin/record/${filteredUsers[0].email}`);
    } else {
      addToast("有多位使用者符合條件", "error");
    }
  };


  return (
    <div className="flex flex-col items-center w-full pt-8">

      <div className=' w-full max-w-md mb-10'>
        <div className="w-full p-3 bg-gray-700 rounded-md mb-4 text-center h-12 text-xl">
          {input || '輸入班級座號'}
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

      <div className="w-full max-w-md p-2 flex items-start gap-6 mt-2 ">
        <input
          type="text"
          placeholder="輸入姓名搜尋"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full sm:w-auto flex-grow p-2 bg-gray-700 border border-gray-600 rounded text-white"
        />
        <button
          onClick={handleUpdateUsers}
          disabled={loading}
          className=" inline-block border-2 border-accent-li bg-gray-800 p-3 px-6 text-base rounded 
                                   hover:bg-gray-700 text-neutral 
                                   transition-colors duration-200 
                                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '更新中...' : '更新使用者資料'}
        </button>
      </div>
      {lastUpdated && (
        <p className="text-xs text-gray-400 mt-2 text-center tracking-wide">
          使用者列表上次更新於: {new Date(lastUpdated).toLocaleString()}
        </p>
      )}
      <div className=' w-full h-32'></div>
    </div>
  );
};

export default AdminHomePage;