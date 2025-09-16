import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStatus } from '../hooks/useAuthStatus'; // 1. 使用我们统一的 Hook
import { TimeRecord, UserProfile } from '../types';
import { UserRole } from '../types';

function ProfilePage() {
  // 2. 从一个 Hook 获取所有需要的用户和权限信息
  const { user, role, loading: authLoading } = useAuthStatus();

  // State for user's profile data from Firestore
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  // State for user's time records
  const [records, setRecords] = useState<TimeRecord[]>([]);
  // Combined loading state
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 确保 Auth 状态加载完毕并且用户已登录
    if (!authLoading && user && user.email) {
      const fetchData = async () => {
        setLoading(true);

        // --- 任务 1: 获取用户的详细个人资料 ---
        const userQuery = query(collection(db, 'users'), where('email', '==', user.email));
        const userSnapshot = await getDocs(userQuery);
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          setUserProfile({ id: userDoc.id, ...userDoc.data() } as UserProfile);
        }

        // --- 任务 2: 获取用户的打卡记录 ---
        const recordsQuery = query(
          collection(db, 'timeRecords'),
          where('userEmail', '==', user.email),
          orderBy('date', 'desc')
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
      // 如果 Auth 加载完毕但用户未登录
      setLoading(false);
    }
  }, [authLoading, user]); // 当 Auth 状态或 user 对象变化时触发

  // 辅助函数，将角色枚举转换为可读的中文
  const getRoleDisplayName = (userRole: UserRole): string => {
    switch (userRole) {
      case UserRole.SuperAdmin: return '最高管理者';
      case UserRole.Admin: return '管理者';
      case UserRole.User: return '一般使用者';
      default: return '访客';
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

      <div className="bg-gray-800 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-bold text-white mb-4">基本資料</h2>
        {userProfile ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
            <div>
              <p className="text-sm text-gray-400">姓名</p>
              <p className="text-lg font-semibold">{userProfile.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">班級</p>
              <p className="text-lg font-semibold">{userProfile.classId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">座號</p>
              <p className="text-lg font-semibold">{userProfile.seatNo}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">身份</p>
              <p className="text-lg font-semibold text-green-400">{getRoleDisplayName(role)}</p>
            </div>
          </div>
        ) : (
          <p>未找到資料</p>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold text-white mb-4 text-left">打卡紀錄</h2>
        {records.length === 0 ? (
          <p className="text-center text-gray-400 bg-gray-800 p-6 rounded-lg">目前沒有任何打卡紀錄。</p>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-3">日期</th>
                  <th className="p-3">簽到時間</th>
                  <th className="p-3">簽退時間</th>
                  <th className="p-3">時數</th>
                </tr>
              </thead>
              <tbody>
                {records.map(record => {
                  let totalHours = 0;
                  if (record.checkIn && record.checkOut) {
                    const deductionMillis = (record.deductionMinutes || 0) * 60 * 1000;
                    const durationMillis = record.checkOut.toMillis() - record.checkIn.toMillis() - deductionMillis;
                    totalHours = Math.max(0, durationMillis / (1000 * 60 * 60));
                  }
                  return (
                    <tr key={record.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                      <td className="p-3">{record.date}</td>
                      <td className="p-3 font-mono">{record.checkIn?.toDate().toLocaleTimeString() || 'N/A'}</td>
                      <td className="p-3 font-mono">{record.checkOut?.toDate().toLocaleTimeString() || 'N/A'}</td>
                      <td className="p-3 font-mono">{totalHours > 0 ? totalHours.toFixed(2) : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;