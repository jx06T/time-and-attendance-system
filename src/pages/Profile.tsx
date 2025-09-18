import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext'; 
import { TimeRecord, UserProfile } from '../types';
import { UserRole } from '../types';
import { formatTime } from '../utils/tools'

function ProfilePage() {
  const { user, role, loading: authLoading } =  useAuth();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user && user.email) {
      const fetchData = async () => {
        setLoading(true);

        const userQuery = query(collection(db, 'users'), where('email', '==', user.email));
        const userSnapshot = await getDocs(userQuery);
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          setUserProfile({ id: userDoc.id, ...userDoc.data() } as UserProfile);
        }

        const recordsQuery = query(
          collection(db, 'timeRecords'),
          where('userEmail', '==', user.email),
          orderBy('date', 'desc'),
          limit(25)
        );
        const recordsSnapshot = await getDocs(recordsQuery);
        const myRecords = recordsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as TimeRecord));
        setRecords(myRecords);

        setLoading(false);
      };

      fetchData();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, user]);

  const getRoleDisplayName = (userRole: UserRole): string => {
    switch (userRole) {
      case UserRole.SuperAdmin: return '最高管理者';
      case UserRole.Admin: return '管理者';
      case UserRole.Clocker: return '打卡負責人';
      case UserRole.User: return '一般使用者';
      default: return '訪客';
    }
  };


  if (loading || authLoading) {
    return <p className="text-center p-8">正在載入個人資料...</p>;
  }

  if (!user) {
    return <p className="text-center p-8">請先登入查看此頁面</p>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">個人檔案</h1>

      <h2 className="text-xl font-bold text-neutral mb-4 text-left">基本資料</h2>

      <div className="bg-gray-800 p-6 rounded-lg mb-8">
        {userProfile ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
            <div>
              <p className="text-sm text-gray-400 mb-0.5">班級</p>
              <p className="text-lg">{userProfile.classId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-0.5">座號</p>
              <p className="text-lg">{userProfile.seatNo}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-0.5">姓名</p>
              <p className="text-lg">{userProfile.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-0.5">身份</p>
              <p className="text-lg text-accent-li">{getRoleDisplayName(role)}</p>
            </div>
          </div>
        ) : (
          <p>未找到資料</p>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold text-neutral mb-4 text-left">打卡紀錄</h2>
        {records.length === 0 ? (
          <p className="text-center text-gray-400 bg-gray-800 p-6 rounded-lg">目前沒有任何打卡紀錄。</p>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-x-auto p-6 py-3">
            <table className="w-full text-left">
              <thead className="bg-gray-800 border-b-2 border-accent">
                <tr>
                  <th className="py-3">日期</th>
                  <th className="py-3">簽到時間</th>
                  <th className="py-3">簽退時間</th>
                  <th className="py-3">時數</th>
                </tr>
              </thead>
              <tbody className=' group'>
                {records.map(record => {
                  let totalHours = 0;
                  if (record.checkIn && record.checkOut) {
                    const deductionMillis = (record.deductionMinutes || 0) * 60 * 1000;
                    const durationMillis = record.checkOut.toMillis() - record.checkIn.toMillis() - deductionMillis;
                    totalHours = Math.max(0, durationMillis / (1000 * 60 * 60));
                  }
                  return (
                    <tr key={record.id} className=" not-last:border-b border-accent ">
                      <td className="py-3">{record.date}</td>
                      <td className="py-3 font-mono">{formatTime(record.checkIn)}</td>
                      <td className="py-3 font-mono">{formatTime(record.checkOut)}</td>
                      <td className="py-3 font-mono">{totalHours > 0 ? totalHours.toFixed(2) : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="w-full h-32"></div>
    </div>
  );
};

export default ProfilePage;