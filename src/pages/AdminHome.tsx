import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import NumericKeypad from '../components/NumericKeypad';

const AdminHomePage = () => {
  const [input, setInput] = useState('');
  const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (input.length < 3) {
      setError('請輸入完整的班級座號 (例如 10101)');
      return;
    }
    setLoading(true);
    setError('');
    setFoundUser(null);

    const classId = input.substring(0, 3);
    const seatNo = input.substring(3);

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('classId', '==', classId), where('seatNo', '==', seatNo));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('找不到此使用者');
      } else {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        if (userData.email) {
          setFoundUser({ id: userDoc.id, ...userData } as UserProfile);
        } else {
          setError('此使用者資料缺少 email，無法進行操作。');
        }
      }
    } catch (err) {
      setError('查詢時發生錯誤');
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-2xl mb-4">管理員操作面板</h2>
      <div className="w-full max-w-xs p-4 border border-blue-400 rounded mb-4 text-center h-12 text-2xl">
        {input || '班級座號'}
      </div>
      <NumericKeypad
        onInput={(val) => setInput(prev => prev + val)}
        onDelete={() => setInput(prev => prev.slice(0, -1))}
        onClear={() => { setInput(''); setFoundUser(null); setError(''); }}
      />
      <button onClick={handleSearch} disabled={loading} className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-8 rounded w-full max-w-xs">
        {loading ? '搜尋中...' : '搜尋'}
      </button>
      {error && <p className="mt-4 text-red-400">{error}</p>}
      {foundUser && (
        <div className="mt-6 p-4 border border-green-400 rounded w-full max-w-xs text-center">
          <p className="text-lg">找到使用者：</p>
          <button
            onClick={() => navigate(`/admin/record/${foundUser.email}`)}
            className="text-3xl text-yellow-300 hover:underline"
          >
            {foundUser.name}
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminHomePage;