import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useToast } from '../hooks/useToast';
import { UserRole } from '../types';

export interface AuthStatus {
    user: User | null;
    role: UserRole;
    loading: boolean;
}

/**
 * 監聽 Firebase Auth 變化，依據 admins 集合判斷角色。
 * @returns {AuthStatus} 包含 user, role, 和 loading 状态的对象。
 */
export const useAuthStatus = (): AuthStatus => {
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
                    } else {
                        setRole(UserRole.Admin);
                    }
                } else {
                    setRole(UserRole.User);
                }
            } catch (error) {
                addToast("無法檢查權限", 'error')
                console.error("檢查管理員權限時發生錯誤:", error);
                setRole(UserRole.User);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    return { user, role, loading };
};