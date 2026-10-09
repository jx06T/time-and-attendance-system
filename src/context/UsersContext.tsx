import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { toLocalDateString } from '../utils/tools';

interface UsersContextType {
    allUsers: UserProfile[];
    pendingEmails: Set<string>;
    pendingDatesByEmail: Map<string, string[]>;
    checkedOutTodayEmails: Set<string>; 
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
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const [pendingEmails, setPendingEmails] = useState<Set<string>>(new Set());
    const [pendingDatesByEmail, setPendingDatesByEmail] = useState<Map<string, string[]>>(new Map());
    const [checkedOutTodayEmails, setCheckedOutTodayEmails] = useState<Set<string>>(new Set());
    const [pendingLoading, setPendingLoading] = useState(true);
    const [todayDate, setTodayDate] = useState(() => toLocalDateString(new Date()));

    useEffect(() => {
        window.localStorage.removeItem('allUsers');
        window.localStorage.removeItem('usersLastUpdated');
        const timer = window.setInterval(() => {
            setTodayDate(toLocalDateString(new Date()));
        }, 60_000);
        return () => window.clearInterval(timer);
    }, []);

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
            addToast("使用者列表更新成功")
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
            setAllUsers([]);
            setLastUpdated(null);
            setPendingEmails(new Set());
            setPendingDatesByEmail(new Map());
            setCheckedOutTodayEmails(new Set());
            setPendingLoading(false);
            return;
        }

        // --- 監聽器 1: 監聽未簽退的人 (checkOut == null) ---
        const pendingQuery = query(collection(db, 'timeRecords'), where('checkOut', '==', null));
        const unsubscribePending = onSnapshot(pendingQuery, (snapshot) => {
            const currentPendingEmails = new Set<string>();
            const datesByEmail = new Map<string, Set<string>>();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.checkIn && typeof data.userEmail === 'string') {
                    currentPendingEmails.add(data.userEmail);
                    if (typeof data.date === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(data.date)) {
                        if (!datesByEmail.has(data.userEmail)) datesByEmail.set(data.userEmail, new Set());
                        datesByEmail.get(data.userEmail)!.add(data.date);
                    }
                }
            });
            setPendingEmails(currentPendingEmails);
            setPendingDatesByEmail(new Map(
                Array.from(datesByEmail, ([email, dates]) => [email, Array.from(dates).sort()])
            ));
            setPendingLoading(false);
        }, (error) => {
            console.error("監聽未簽退記錄失敗:", error);
            addToast("監聽未簽退記錄失敗", "error");
            setPendingLoading(false);
        });

        // --- 監聽器 2: 監聽今天已簽退的人 (date == today, checkOut != null) ---
        const completedQuery = query(
            collection(db, 'timeRecords'),
            where('date', '==', todayDate),
            where('checkOut', '!=', null)
        );
        const unsubscribeCompleted = onSnapshot(completedQuery, (snapshot) => {
            const currentCompletedEmails = new Set<string>();
            snapshot.docs.forEach(doc => {
                currentCompletedEmails.add(doc.data().userEmail);
            });
            setCheckedOutTodayEmails(currentCompletedEmails);
        }, (error) => {
            console.error("監聽今日已簽退記錄失敗:", error);
            addToast("監聽今日已簽退記錄失敗", "error");
        });

        // 返回一個 cleanup 函數來取消兩個訂閱
        return () => {
            unsubscribePending();
            unsubscribeCompleted();
        };
    }, [role, addToast, todayDate]);

    const getUserByEmail = useCallback((email: string): UserProfile | undefined => {
        return allUsers.find(user => user.email.toLowerCase() === email.toLowerCase());
    }, [allUsers]);

    const value = { allUsers, pendingEmails, pendingDatesByEmail, checkedOutTodayEmails, loading, pendingLoading, lastUpdated, fetchUsers, getUserByEmail };

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
