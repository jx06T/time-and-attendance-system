import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStatus, AuthStatus } from '../hooks/useAuthStatus';
import Layout from '../layout/Layout';
import { UserRole } from '../types';

export function AuthGuard({ children }: { children: React.ReactElement }) {
    const { role, loading }: AuthStatus = useAuthStatus();

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen text-neutral-100  grid-background">正在驗證身分...</div>;
    }

    if (role !== UserRole.Visitor) {
        return (
            <Layout>
                <Outlet />
            </Layout>
        );
    } else {
        return <Navigate to="/" replace />;
    }
};