import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext'; 
import RankingsReport from '../components/admin/RankingsReport';
import ImportUsers from '../components/admin/ImportUsers';
import UserReport from '../components/admin/UserReport';
import PermissionsManager from '../components/admin/PermissionsManager';
import { UserRole } from '../types';
import { useUsers } from '../context/UsersContext';


type AdminTabKey = 'rankings' | 'userReport' | 'import' | 'permissions';
interface AdminTab {
    key: AdminTabKey;
    label: string;
    component: React.FC;
}

function AdminPage() {
    const { role } =  useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const { fetchUsers } = useUsers();
    const availableTabs = useMemo((): AdminTab[] => {
        const tabs: AdminTab[] = [
            { key: 'rankings', label: '查看週報表', component: RankingsReport },
            { key: 'userReport', label: '查看單人報表', component: UserReport },
        ];
        if (role === UserRole.SuperAdmin) {
            tabs.push({ key: 'import', label: '匯入使用者', component: ImportUsers });
            tabs.push({ key: 'permissions', label: '權限管理', component: PermissionsManager });
        }
        return tabs;
    }, [role]);

    const currentTabKey = location.hash.replace('#', '') as AdminTabKey;

    const activeTab = useMemo(() => {
        const foundTab = availableTabs.find(tab => tab.key === currentTabKey);
        return foundTab ? foundTab.key : availableTabs[0].key;
    }, [currentTabKey, availableTabs]);

    const handleTabClick = (tabKey: AdminTabKey) => {
        navigate(`#${tabKey}`);
    };

    const ActiveComponent = availableTabs.find(tab => tab.key === activeTab)?.component;

    return (
        <div className="max-w-6xl mx-auto px-4 relative">
            <h1 className="text-3xl font-bold mb-8 text-center">管理員後台</h1>

            <div className="flex border-b-2 border-gray-400 mb-8 overflow-x-auto">
                {availableTabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabClick(tab.key)}
                        className={`py-1 px-4 text-sm sm:text-base transition-colors whitespace-nowrap ${activeTab === tab.key
                            ? 'border-b-2 border-accent-li text-neutral'
                            : 'text-gray-300 hover:text-gray-200'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}

            </div>

            <div className="animate-fade-in">
                {ActiveComponent && <ActiveComponent />}
            </div>
            <button
                onClick={fetchUsers}
                className=" bottom-8 right-0 border-2 border-accent-li text-accent-li font-bold py-2 px-4 rounded text-base absolute cursor-pointer"
            >
                更新使用者列表
            </button>
        </div>
    );
};

export default AdminPage;