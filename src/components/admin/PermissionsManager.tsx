import { useState, useEffect, useMemo, use } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { UserRole, UserProfile } from '../../types';
import { useUsers } from '../../context/UsersContext';
import BasicSelect, { SelectOption } from '../ui/BasicSelect';
import { useToast } from '../../hooks/useToast';
import { createConfirmDialog } from '../../utils/createConfirmDialog';

type UserWithRole = UserProfile & { role: UserRole };

const DELETE_ACTION_VALUE = 'delete_user_action';

function PermissionsManager() {
    const { addToast } = useToast();
    const { user: currentUser } = useAuth();
    const { allUsers, fetchUsers, loading: usersLoading } = useUsers();

    const [adminRoles, setAdminRoles] = useState<Map<string, UserRole>>(new Map());
    const [rolesLoading, setRolesLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null); // 使用 user.id 来追踪

    useEffect(() => {
        const fetchRoles = async () => {
            setRolesLoading(true);
            try {
                const adminsSnapshot = await getDocs(collection(db, 'admins'));
                const rolesMap = new Map<string, UserRole>();
                adminsSnapshot.forEach(doc => {
                    const role = doc.data().role;
                    rolesMap.set(doc.id, role);
                });
                setAdminRoles(rolesMap);
            } catch (err: any) {
                addToast(`載入權限資料失敗： ${err.message}`, 'error');
            } finally {
                setRolesLoading(false);
            }
        };
        fetchRoles();
    }, []);

    const handleActionChange = async (targetUser: UserProfile, selectedValue: string) => {
        if (!currentUser) return;
        if (targetUser.uid === currentUser.uid) {
            addToast("無法修改自己的權限。", 'error');
            return;
        }

        setProcessingId(targetUser.id);

        if (selectedValue === DELETE_ACTION_VALUE) {

            createConfirmDialog({
                title: "確認刪除",
                message: `您確定要永久刪除使用者 "${targetUser.name}" (${targetUser.email}) 嗎？\n此操作無法復原！`,
                confirmText: "確認刪除",
                cancelText: "取消",
                onConfirm: async () => {
                    try {
                        const batch = writeBatch(db);
                        const userDocRef = doc(db, 'users', targetUser.id);
                        batch.delete(userDocRef);
                        if (targetUser.uid && (adminRoles.has(targetUser.uid))) {
                            const adminDocRef = doc(db, 'admins', targetUser.uid);
                            batch.delete(adminDocRef);
                        }
                        await batch.commit();
                        await fetchUsers();
                        addToast(`已成功刪除使用者: ${targetUser.name}`);
                    } catch (err: any) {
                        addToast(`刪除使用者失敗: ${err.message}`, 'error');
                    } finally {
                        setProcessingId(null);
                    }
                }, onCancel: () => {
                    console.log("操作取消");
                    setProcessingId(null);
                }
            });
        } else {
            if (!targetUser.uid) {
                addToast(`使用者 ${targetUser.name} 尚未登入過，無法指派權限。`, 'error');
                setProcessingId(null);
                return;
            }
            const newRole = selectedValue as UserRole;
            try {
                const adminDocRef = doc(db, 'admins', targetUser.uid);
                if (newRole === UserRole.Admin || newRole === UserRole.Clocker || newRole === UserRole.SuperAdmin) {
                    await setDoc(adminDocRef, { role: newRole });
                } else {
                    await deleteDoc(adminDocRef);
                }
                setAdminRoles(prevRoles => {
                    const newRoles = new Map(prevRoles);
                    if (newRole === UserRole.User) { newRoles.delete(targetUser.uid!); }
                    else { newRoles.set(targetUser.uid!, newRole); }
                    return newRoles;
                });
                addToast(`已成功將 ${targetUser.name} 的權限更新為 ${newRole}。`);
            } catch (err: any) {
                addToast(`更新權限失敗： ${err.message}`, 'error');
            } finally {
                setProcessingId(null);
            }
        }
    };

    const displayUsers = useMemo((): UserWithRole[] => {
        console.log(adminRoles, allUsers)
        const combined = allUsers.map(user => ({ ...user, role: adminRoles.get(user.uid!) || UserRole.User }));
        if (!searchTerm) return combined;
        const lowercasedTerm = searchTerm.toLowerCase();
        return combined.filter(user => (
            user.name.toLowerCase().includes(lowercasedTerm) ||
            user.classId.toLowerCase().includes(lowercasedTerm) ||
            user.seatNo.toLowerCase().includes(lowercasedTerm) ||
            user.email.toLowerCase().includes(lowercasedTerm) ||
            `${user.classId}${user.seatNo}`.startsWith(lowercasedTerm))
        );
    }, [allUsers, adminRoles, searchTerm]);

    const loading = usersLoading || rolesLoading;
    if (loading) return <p className="text-center p-8">正在載入使用者與權限列表...</p>;

    return (
        <>
            <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">權限管理</h3>
                <input type="text" placeholder="按關鍵字搜尋使用者..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded mb-4" />
                <div className="overflow-x-auto max-h-[60vh] bg-gray-900 rounded">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-700 sticky top-0"><tr><th className="p-3 px-4">姓名</th><th className="p-3 px-4">Email</th><th className="p-3 px-4">當前權限</th><th className="p-3 px-4">操作</th></tr></thead>
                        <tbody>
                            {displayUsers.map(user => {
                                const baseOptions: SelectOption[] = [
                                    { value: UserRole.User, label: '一般使用者' },
                                ];

                                if (user.uid) {
                                    baseOptions.push({ value: UserRole.Clocker, label: '打卡負責人' });
                                    baseOptions.push({ value: UserRole.Admin, label: '管理者' });
                                    baseOptions.push({ value: UserRole.SuperAdmin, label: '最高管理者' });
                                }

                                baseOptions.push({
                                    value: DELETE_ACTION_VALUE,
                                    label: '刪除使用者！',
                                    className: 'font-bold bg-red-600 hover:bg-red-700', // 自訂樣式
                                });

                                return (
                                    <tr key={user.id} className="not-last:border-b border-gray-700">
                                        <td className="p-3 px-4 h-14">{user.name}</td>
                                        <td className="p-3 px-4">{user.email}</td>
                                        <td className="p-3 px-4"><span className={`px-2 py-1 text-xs rounded font-semibold ${user.role === UserRole.SuperAdmin ? 'bg-red-700 text-red-50' : user.role === UserRole.Admin ? 'bg-accent-li/90 text-neutral' : user.role === UserRole.Clocker ? 'bg-accent-li/40 text-neutral' : 'bg-gray-600 text-gray-200'}`}>{user.role}</span></td>
                                        <td className="p-3 px-4">
                                            {processingId === user.id ? (<span>處理中...</span>) : (
                                                <BasicSelect
                                                    value={user.role}
                                                    options={baseOptions}
                                                    onChange={(e) => handleActionChange(user, e)}
                                                    disabled={user.uid === currentUser?.uid}
                                                />

                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className=' w-full h-32'></div>
        </>
    );
};

export default PermissionsManager;