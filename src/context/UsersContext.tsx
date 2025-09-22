import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, UserRole, TimeRecord } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';

interface UsersContextType {
    allUsers: UserProfile[];
    pendingEmails: Set<string>;
    loading: boolean;
    pendingLoading: boolean;
    lastUpdated: string | null;
    fetchUsers: () => Promise<void>;
    getUserByEmail: (email: string) => UserProfile | undefined;
}

const UsersContext = createContext<UsersContextType | undefined>(undefined);

export function UsersProvider({ children }: { children: React.ReactNode }) {
    const { role } = useAuth();
    const { addToast } = useToast();
    const [allUsers, setAllUsers] = useLocalStorage<UserProfile[]>('allUsers', []);
    const [lastUpdated, setLastUpdated] = useLocalStorage<string | null>('usersLastUpdated', null);
    const [loading, setLoading] = useState(false);

    const [pendingEmails, setPendingEmails] = useState<Set<string>>(new Set());
    const [pendingLoading, setPendingLoading] = useState(true);
    const isInitialMount = useRef(true);

    const fetchUsers = useCallback(async () => {
        if (role === UserRole.User || role === UserRole.Visitor) {
            return;
        }
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            const usersList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as UserProfile));
            setAllUsers(usersList);
            setLastUpdated(new Date().toISOString());
        } catch (error) {
            console.error("Failed to fetch users:", error);
            addToast(`更新使用者列表失敗`, 'error');
        } finally {
            setLoading(false);
        }
    }, [role, setAllUsers, setLastUpdated, addToast]);

    useEffect(() => {
        if (role === UserRole.User || role === UserRole.Visitor) {
            return;
        }
        if (allUsers.length === 0) {
            fetchUsers();
        }
    }, [role, allUsers.length, fetchUsers]);

    useEffect(() => {
        if (role === UserRole.User || role === UserRole.Visitor) {
            setPendingLoading(false);
            return;
        }
        const q = query(collection(db, 'timeRecords'), where('checkOut', '==', null));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const currentEmails = new Set<string>();
            // const userMap = new Map<string, UserProfile>();
            // allUsers.forEach(u => userMap.set(u.email, u));

            // snapshot.docChanges().forEach((change) => {
            //     const data = change.doc.data() as TimeRecord;
            //     const user = userMap.get(data.userEmail);

            //     if (!isInitialMount.current && user) {
            //         if (change.type === 'added' && data.checkIn && !data.checkOut) {
            //             addToast(`${user.name} 簽到`);
            //         }
            //         if (change.type === 'modified' && data.checkOut) {
            //             addToast(`${user.name} 簽退`);
            //         }
            //     }
            // });

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.checkIn) {
                    currentEmails.add(data.userEmail);
                }
            });

            setPendingEmails(currentEmails);
            if (pendingLoading) setPendingLoading(false);
            if (isInitialMount.current) isInitialMount.current = false;

        }, (error) => {
            console.error("監聽未簽退記錄失敗:", error);
            addToast("監聽異常記錄失敗", "error");
            if (pendingLoading) setPendingLoading(false);
        });

        return () => unsubscribe();
    }, [role, addToast, allUsers, pendingLoading]);

    const getUserByEmail = useCallback((email: string): UserProfile | undefined => {
        return allUsers.find(user => user.email.toLowerCase() === email.toLowerCase());
    }, [allUsers]);

    const value = { allUsers, pendingEmails, loading, pendingLoading, lastUpdated, fetchUsers, getUserByEmail };

    return (
        <UsersContext.Provider value={value}>
            {children}
        </UsersContext.Provider>
    );
};

export const useUsers = (): UsersContextType => {
    const context = useContext(UsersContext);
    if (context === undefined) {
        throw new Error('useUsers must be used within a UsersProvider');
    }
    return context;
};