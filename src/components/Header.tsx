import { Link, useNavigate } from 'react-router-dom';

import { useAuthStatus } from '../hooks/useAuthStatus';
import { UserRole } from '../types';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

function Header() {
    const { user, role, loading } = useAuthStatus();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            localStorage.removeItem('allUsers');
            localStorage.removeItem('usersLastUpdated');
            navigate('/');
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    const renderNavLinks = () => {
        if (loading) return null;

        if (role === UserRole.Admin || role === UserRole.SuperAdmin) {
            return (
                <>
                    <Link to="/profile">我的頁面</Link>
                    <Link to="/admin/dashboard">打卡</Link>
                    <Link to="/admin/reports">管理面板</Link>
                </>
            );
        }
        if (role === UserRole.User) {
            return <Link to="/profile">我的頁面</Link>;
        }

        return <Link to="/login">登入</Link>;
    };

    return (
        <header className="bg-gray-800 text-white p-4 flex justify-between items-center shadow-md">
            <Link to="/" className="text-xl font-bold hover:text-blue-300">
                打卡系統
            </Link>

            <div className="flex items-center gap-6">
                <nav className="flex items-center gap-4 text-sm font-semibold">
                    {renderNavLinks()}
                </nav>

                {user && (
                    <div className="flex items-center gap-3 border-l border-gray-600 pl-6">
                        <span className="text-sm">{user.displayName || user.email}</span>
                        <button
                            onClick={handleLogout}
                            className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-sm transition-colors"
                        >
                            登出
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};
export default Header;
