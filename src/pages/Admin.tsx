import React, { useState, useMemo } from 'react';

import { useAuthStatus } from '../hooks/useAuthStatus';

import RankingsReport from '../components/admin/RankingsReport';
import ImportUsers from '../components/admin/ImportUsers';
import UserReport from '../components/admin/UserReport';
import PermissionsManager from '../components/admin/PermissionsManager';
import { UserRole } from '../types';

// 定义 Tab 的类型
type AdminTab = 'rankings' | 'userReport' | 'import' | 'permissions';

const AdminPage = () => {
    const { role } = useAuthStatus();

    // 2. 根据角色动态生成可用的 Tab 列表
    const availableTabs = useMemo((): { key: AdminTab; label: string; component: React.FC }[] => {
        const tabs = [
            { key: 'rankings' as AdminTab, label: '查看週報表', component: RankingsReport },
            { key: 'userReport' as AdminTab, label: '查看單人報表', component: UserReport },
        ];

        // 只有 SuperAdmin 才能看到额外的 Tab
        if (role === UserRole.SuperAdmin) {
            tabs.push({ key: 'import' as AdminTab, label: '匯入使用者', component: ImportUsers });
            tabs.push({ key: 'permissions' as AdminTab, label: '權限管理', component: PermissionsManager });
        }

        return tabs;
    }, [role]); // 当角色变化时，重新计算

    // 3. activeTab 的初始值应该是可用列表的第一个
    const [activeTab, setActiveTab] = useState<AdminTab>(availableTabs[0].key);

    // 4. 找到当前激活的 Tab 对应的组件
    const ActiveComponent = availableTabs.find(tab => tab.key === activeTab)?.component;

    return (
        <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl text-center mb-6">管理員後台</h2>

            {/* Tab 切换按钮: 根据 availableTabs 动态渲染 */}
            <div className="flex border-b border-gray-700 mb-8">
                {availableTabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`py-2 px-4 text-sm sm:text-base transition-colors ${activeTab === tab.key
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