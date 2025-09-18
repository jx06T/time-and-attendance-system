import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; 
import { UserRole } from '../types';
import Layout from '../layout/Layout';

interface AuthorizationGuardProps {
    allowedRoles: UserRole[];
}

export const AuthorizationGuard: React.FC<AuthorizationGuardProps> = ({ allowedRoles }) => {
    const { role, loading } =  useAuth();

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen text-neutral-100 grid-background">正在驗證權限...</div>;
    }

    const isAuthorized = allowedRoles.includes(role);

    if (isAuthorized) {
        return (
            <Layout>
                <Outlet />
            </Layout>
        );
    } else {
        return <Navigate to="/" replace />;
    }
};