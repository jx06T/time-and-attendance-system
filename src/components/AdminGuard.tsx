import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAdminStatus } from '../hooks/useAdminStatus'; // 重複使用我們建立的 Hook

export const AdminGuard: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminStatus();

  const loading = authLoading || adminLoading;

  if (loading) {
    return <div>Loading...</div>;
  }

  // 只要 "未登入" 或 "不是管理員"，就導走
  if (!user || !isAdmin) {
    return <Navigate to="/" replace />; // 導向首頁，因為他可能已登入但不是管理員
  }

  return children;
};