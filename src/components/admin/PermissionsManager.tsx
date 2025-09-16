import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStatus } from '../../hooks/useAuthStatus';
import { UserRole, UserProfile } from '../../types';

// 结合用户资料和角色，方便在 UI 中渲染
type UserWithRole = UserProfile & {
    role: UserRole;
};

function PermissionsManager() {
    const { user: currentUser } = useAuthStatus(); // 获取当前登录的最高管理者信息

    // --- State 管理 ---
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [adminRoles, setAdminRoles] = useState<Map<string, UserRole>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [processingUid, setProcessingUid] = useState<string | null>(null); // 正在被修改的用户ID

    // --- 数据获取 ---
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 使用 Promise.all 并发获取 users 和 admins 集合
                const [usersSnapshot, adminsSnapshot] = await Promise.all([
                    getDocs(collection(db, 'users')),
                    getDocs(collection(db, 'admins'))
                ]);

                // 处理用户列表
                const usersList = usersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as UserProfile));
                setAllUsers(usersList);

                // 处理角色映射
                const rolesMap = new Map<string, UserRole>();
                adminsSnapshot.forEach(doc => {
                    const role = doc.data().role === 'superadmin' ? UserRole.SuperAdmin : UserRole.Admin;
                    rolesMap.set(doc.id, role);
                });
                console.log(adminsSnapshot)
                setAdminRoles(rolesMap);

            } catch (err: any) {
                setError(`载入资料失败: ${err.message}`);
                console.error(err)
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []); // 空依赖数组，只在组件挂载时执行一次

    // --- 核心逻辑：处理权限变更 ---
    const handleRoleChange = async (targetUser: UserProfile, newRole: UserRole) => {
        if (!targetUser.uid || !currentUser) return;

        // 安全检查：禁止最高管理者修改自己的权限
        if (targetUser.uid === currentUser.uid) {
            setError("无法修改自己的权限。");
            return;
        }

        setProcessingUid(targetUser.uid);
        setError('');
        setSuccess('');

        try {
            const adminDocRef = doc(db, 'admins', targetUser.uid);

            if (newRole === UserRole.Admin || newRole === UserRole.SuperAdmin) {
                // 晋升为 Admin 或 SuperAdmin
                await setDoc(adminDocRef, { role: newRole });
            } else {
                // 降级为 User
                await deleteDoc(adminDocRef);
            }

            // 更新本地 state 以立即反映 UI 变化，无需重新获取数据
            setAdminRoles(prevRoles => {
                const newRoles = new Map(prevRoles);
                if (newRole === UserRole.User) {
                    newRoles.delete(targetUser.uid!);
                } else {
                    newRoles.set(targetUser.uid!, newRole);
                }
                return newRoles;
            });

            setSuccess(`已成功将 ${targetUser.name} 的权限更新为 ${newRole}。`);

        } catch (err: any) {
            setError(`更新权限失败: ${err.message}`);
        } finally {
            setProcessingUid(null);
        }
    };

    // --- 渲染逻辑：结合用户列表、角色和搜索词 ---
    const displayUsers = useMemo((): UserWithRole[] => {
        const combined = allUsers.map(user => ({
            ...user,
            role: adminRoles.get(user.uid!) || UserRole.User,
        }));

        if (!searchTerm) return combined;

        const lowercasedTerm = searchTerm.toLowerCase();
        return combined.filter(user =>
            user.name.toLowerCase().includes(lowercasedTerm) ||
            user.email.toLowerCase().includes(lowercasedTerm)
        );
    }, [allUsers, adminRoles, searchTerm]);


    if (loading) return <p className="text-center p-8">正在载入使用者与权限列表...</p>;

    return (
        <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-4">权限管理</h3>

            {/* 搜索框 */}
            <input
                type="text"
                placeholder="按姓名或 Email 搜索使用者..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded mb-4"
            />

            {/* 状态信息 */}
            {error && <p className="text-center text-red-400 mb-4">{error}</p>}
            {success && <p className="text-center text-green-400 mb-4">{success}</p>}

            {/* 用户权限列表 */}
            <div className="overflow-x-auto max-h-[60vh] bg-gray-900 rounded">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-700 sticky top-0">
                        <tr>
                            <th className="p-3">姓名</th>
                            <th className="p-3">Email</th>
                            <th className="p-3">当前权限</th>
                            <th className="p-3">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayUsers.map(user => (
                            <tr key={user.id} className="border-b border-gray-700">
                                <td className="p-3">{user.name}</td>
                                <td className="p-3">{user.email}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 text-xs rounded font-semibold ${user.role === UserRole.SuperAdmin ? 'bg-red-700 text-red-200' :
                                        user.role === UserRole.Admin ? 'bg-yellow-700 text-yellow-200' : 'bg-gray-600 text-gray-200'
                                        }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="p-3">
                                    {processingUid === user.uid ? (
                                        <span>尚未獲取 UID</span>
                                    ) : (
                                        <select
                                            value={user.role}
                                            onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                                            disabled={user.uid === currentUser?.uid}
                                            className="bg-gray-700 border border-gray-600 rounded p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <option value={UserRole.User}>一般使用者</option>
                                            <option value={UserRole.Admin}>管理者</option>
                                            <option value={UserRole.SuperAdmin}>最高管理者</option>
                                        </select>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PermissionsManager;