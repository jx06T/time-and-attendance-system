import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useToast } from '../hooks/useToast';
import { UserRole } from '../types';

export interface IAuthContext {
    user: User | null;
    role: UserRole;
    loading: boolean;
}

const AuthContext = createContext<IAuthContext | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole>(UserRole.Visitor);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
            setLoading(true);
            setUser(authUser);

            if (!authUser) {
                setRole(UserRole.Visitor);
                setLoading(false);
                return;
            }

            try {
                const adminDocRef = doc(db, 'admins', authUser.uid);
                const adminDocSnap = await getDoc(adminDocRef);

                if (adminDocSnap.exists()) {
                    const adminData = adminDocSnap.data();
                    if (adminData.role === 'superadmin') {
                        setRole(UserRole.SuperAdmin);
                    } else if (adminData.role === 'admin') {
                        setRole(UserRole.Admin);
                    } else if (adminData.role === 'clocker') {
                        setRole(UserRole.Clocker);
                    } else {
                        setRole(UserRole.User);
                    }
                } else {
                    setRole(UserRole.User);
                }
            } catch (error) {
                // addToast("無法檢查權限", 'error')
                console.error("檢查管理員權限時發生錯誤:", error);
                setRole(UserRole.User);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [addToast]);
    const value = { user, role, loading };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === null) {
        throw new Error('useAuth 必須在 AuthProvider 內部使用');
    }
    return context;
};