import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import { useAuthStatus } from '../hooks/useAuthStatus';
import { UserRole } from '../types';
import { useToast } from '../hooks/useToast';

interface UsersContextType {
    allUsers: UserProfile[];
    loading: boolean;
    lastUpdated: string | null;
    fetchUsers: () => Promise<void>;
    getUserByEmail: (email: string) => UserProfile | undefined;
}

const UsersContext = createContext<UsersContextType | undefined>(undefined);

export const UsersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { role } = useAuthStatus();

    const [allUsers, setAllUsers] = useLocalStorage<UserProfile[]>('allUsers', []);
    const [lastUpdated, setLastUpdated] = useLocalStorage<string | null>('usersLastUpdated', null);
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();

    const fetchUsers = useCallback(async () => {

        addToast("更新使用者列表")
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
            addToast(`Failed to fetch users:${error}`)
            console.error("Failed to fetch users:", error);
        } finally {
            setLoading(false);
        }
    }, [setAllUsers, setLastUpdated]);

    useEffect(() => {
        if (role === UserRole.Visitor) {
            return
        }
        if (allUsers.length === 0) {
            fetchUsers();
        }
    }, [allUsers.length, fetchUsers]);

    const getUserByEmail = useCallback((email: string): UserProfile | undefined => {
        return allUsers.find(user => user.email.toLowerCase() === email.toLowerCase());
    }, [allUsers]);

    const value = { allUsers, loading, lastUpdated, fetchUsers, getUserByEmail };

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