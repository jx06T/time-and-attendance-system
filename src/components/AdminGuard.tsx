import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStatus, AuthStatus } from '../hooks/useAuthStatus';
import { UserRole } from '../types';
import Layout from '../layout/Layout';

export function AdminGuard({ children }: { children: React.ReactElement }) {

    const { role, loading }: AuthStatus = useAuthStatus();

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen">正在驗證權限</div>;
    }

    if (role === UserRole.Admin || role === UserRole.SuperAdmin) {
        return (
            <Layout>
                <Outlet />
            </Layout>
        );
    } else {
        return <Navigate to="/" replace />;
    }
};