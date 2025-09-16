import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuthStatus } from '../hooks/useAuthStatus';
import RankingsReport from '../components/admin/RankingsReport';
import ImportUsers from '../components/admin/ImportUsers';
import UserReport from '../components/admin/UserReport';
import PermissionsManager from '../components/admin/PermissionsManager';
import { UserRole } from '../types';


// 定义 Tab 的类型
type AdminTabKey = 'rankings' | 'userReport' | 'import' | 'permissions';
interface AdminTab {
    key: AdminTabKey;
    label: string;
    component: React.FC;
}

const AdminPage = () => {
    const { role } = useAuthStatus();
    const location = useLocation();
    const navigate = useNavigate();

    // 根据角色动态生成可用的 Tab 列表
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

    useEffect(() => {
        if (!availableTabs.some(tab => tab.key === currentTabKey)) {
            navigate(`#${availableTabs[0].key}`, { replace: true });
        }
    }, [availableTabs, currentTabKey, navigate]);


    return (
        <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl text-center mb-6">管理員後台</h2>

            <div className="flex border-b border-gray-700 mb-8 overflow-x-auto">
                {availableTabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabClick(tab.key)}
                        className={`py-2 px-4 text-sm sm:text-base transition-colors whitespace-nowrap ${activeTab === tab.key
                            ? 'border-b-2 border-blue-400 text-white'
                            : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="animate-fade-in">
                {ActiveComponent && <ActiveComponent />}
            </div>
        </div>
    );
};

export default AdminPage;