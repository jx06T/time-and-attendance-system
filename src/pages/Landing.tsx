import { Link } from 'react-router-dom';
import { useAdminStatus } from '../hooks/useAdminStatus';
import { useAuth } from '../context/AuthContext';

const LandingPage = () => {
    const { user, loading: authLoading } = useAuth();
    const { isAdmin, loading: adminLoading } = useAdminStatus();

    const isLoading = authLoading || adminLoading;

    const renderAction = () => {
        if (isLoading) {
            return <div className="bg-gray-600 h-16 w-64 mx-auto rounded-lg animate-pulse"></div>;
        }

        if (user) {
            if (isAdmin) {
                return (
                    <Link to="/admin/dashboard" className="bg-red-600 ...">
                        進入管理面板
                    </Link>
                );
            } else {
                return (
                    <Link to="/dashboard" className="bg-blue-600 ...">
                        進入個人頁面
                    </Link>
                );
            }
        }

        return (
            <Link to="/login" className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-10 rounded-lg text-xl inline-block ...">
                登入以開始
            </Link>
        );
    };

    return (
        <div className="text-center max-w-2xl mx-auto p-8">
            <h1 className="text-5xl font-bold mb-4">
                歡迎來到<br />工業藍圖打卡系统
            </h1>
            <p className="text-lg text-gray-400 mb-12">
                {user ? `你好, ${user.displayName || '使用者'}！` : '一個現代化的出缺席打卡系統'}
            </p>

            {renderAction()}
        </div>
    );
};

export default LandingPage;