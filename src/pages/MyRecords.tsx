import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext'; // 用 useAuth 取得當前使用者
import { TimeRecord } from '../types';

const MyRecordsPage = () => {
  const { user } = useAuth(); // 取得登入的使用者資訊
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 只有在 user 物件存在 (已登入) 且有 email 時才執行查詢
    if (user && user.email) {
      const fetchMyRecords = async () => {
        setLoading(true);

        // 根據當前登入者的 email 查詢 timeRecords 集合
        const q = query(
          collection(db, 'timeRecords'),
          where('userEmail', '==', user.email),
          orderBy('date', 'desc') // 按照日期降序排列，最新的在最上面
        );

        const querySnapshot = await getDocs(q);
        const myRecords = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as TimeRecord));

        setRecords(myRecords);
        setLoading(false);
      };

      fetchMyRecords();
    } else {
      // 如果因故沒有 user 或 user.email，停止載入
      setLoading(false);
    }
  }, [user]); // 當 user 狀態改變時，重新執行

  if (loading) {
    return <p className="text-center">正在載入您的打卡紀錄...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-3xl text-center mb-6">我的打卡紀錄</h2>

      {records.length === 0 ? (
        <p className="text-center text-gray-400">目前沒有任何打卡紀錄。</p>
      ) : (
        <div className="bg-gray-800 p-4 rounded-lg">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="p-2">日期</th>
                <th className="p-2">簽到時間</th>
                <th className="p-2">簽退時間</th>
                <th className="p-2">總工時 (小時)</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => {
                let totalHours = 0;
                if (record.checkIn && record.checkOut) {
                  const diffMillis = record.checkOut.toMillis() - record.checkIn.toMillis();
                  totalHours = diffMillis / 1000 / 60 / 60;
                }

                return (
                  <tr key={record.id} className="border-b border-gray-700 hover:bg-gray-700">
                    <td className="p-2">{record.date}</td>
                    <td className="p-2">{record.checkIn?.toDate().toLocaleTimeString() || 'N/A'}</td>
                    <td className="p-2">{record.checkOut?.toDate().toLocaleTimeString() || 'N/A'}</td>
                    <td className="p-2">{totalHours > 0 ? totalHours.toFixed(2) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MyRecordsPage;