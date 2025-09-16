import { Link } from 'react-router-dom';
import { useAuthStatus } from '../hooks/useAuthStatus';
import { UserRole } from '../types';

const LandingPage = () => {
    const { user, role, loading } = useAuthStatus();

    const renderAction = () => {
        if (loading) {
            return (
                <div className="bg-gray-700 h-16 w-64 mx-auto rounded-lg animate-pulse"></div>
            );
        }

        if (role === UserRole.Admin || role === UserRole.SuperAdmin) {
            return (
                <Link
                    to="/admin/dashboard"
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-10 rounded-lg text-xl inline-block transition-transform transform hover:scale-105"
                >
                    進入管理面板
                </Link>
            );
        }

        if (role === UserRole.User) {
            return (
                <Link
                    to="/profile"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-lg text-xl inline-block transition-transform transform hover:scale-105"
                >
                    進入我的主頁
                </Link>
            );
        }

        return (
            <Link
                to="/login"
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-10 rounded-lg text-xl inline-block transition-transform transform hover:scale-105"
            >
                登入以開始
            </Link>
        );
    };

    return (
        <div className="text-center max-w-2xl mx-auto p-8">
            <h1 className="text-5xl font-bold mb-4">
                歡迎來到<br />工業藍圖打卡系統
            </h1>
            <p className="text-lg text-gray-400 mb-12">
                {user ? `你好, ${user.displayName || ''}！` : '一個現代化的出勤管理解決方案。'}
            </p>

            {renderAction()}
        </div>
    );
};

export default LandingPage;