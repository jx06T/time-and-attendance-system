import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

export const useAdminStatus = () => {
    const { user } = useAuth();
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const checkAdminStatus = async () => {
            if (!user) {
                setIsAdmin(false);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const adminDocRef = doc(db, 'admins', user.uid);
                const adminDocSnap = await getDoc(adminDocRef);

                setIsAdmin(adminDocSnap.exists());

            } catch (error) {
                console.error("检查管理员身份时出错:", error);
                setIsAdmin(false);
            } finally {
                setLoading(false);
            }
        };

        checkAdminStatus();
    }, [user]);

    return { isAdmin, loading };
};