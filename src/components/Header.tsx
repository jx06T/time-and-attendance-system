import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAdminStatus } from '../hooks/useAdminStatus'; // 1. 引入 useAdminStatus
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

const Header = () => {
    const { user } = useAuth();
    const { isAdmin } = useAdminStatus(); // 2. 获取 isAdmin 状态
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            // 登出后重定向到首页，LandingPage 会处理后续逻辑
            localStorage.removeItem('allUsers');
            localStorage.removeItem('usersLastUpdated');
            navigate('/');
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    // 3. 将导航链接的渲染逻辑提取到一个函数中，使代码更清晰
    const renderNavLinks = () => {
        // --- 情况一：用户已登录 ---
        if (user) {
            return (
                <>
                    {/* 3a. 如果是管理员，显示所有管理链接 */}
                    {isAdmin && (
                        <>
                            <Link to="/admin/dashboard" className="hover:text-blue-300">打卡</Link>
                            <Link to="/admin/reports" className="hover:text-blue-300">管理面板</Link>
                        </>
                    )}
                    {/* 3b. 如果是普通用户，只显示个人链接 (或根据需求添加) */}
                    {!isAdmin && (
                        <Link to="/my-records" className="hover:text-blue-300">我的頁面</Link>
                    )}
                </>
            );
        }

        // --- 情况二：用户未登录 ---
        return (
            <>
                {/* 你的 GitHub 链接 */}
                <a
                    href="https://github.com/your-repo" // TODO: 替换成你的 GitHub 仓库链接
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-300"
                >
                    查看 GitHub
                </a>
                <Link to="/login" className="hover:text-blue-300">登入</Link>
            </>
        );
    };

    return (
        <header className="bg-gray-800 text-white p-4 flex justify-between items-center shadow-md">
            {/* 点击 Logo/标题可以回到首页 */}
            <Link to="/" className="text-xl font-bold hover:text-blue-300">
                工业蓝图打卡系统
            </Link>

            <div className="flex items-center gap-6">
                {/* 导航链接区域 */}
                <nav className="flex items-center gap-4 text-sm font-semibold">
                    {renderNavLinks()}
                </nav>

                {/* 用户信息和登出按钮区域 */}
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