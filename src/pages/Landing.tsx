import { Navigate } from 'react-router-dom';
import { useAdminStatus } from '../hooks/useAdminStatus';

const LandingPage = () => {
    const { isAdmin, loading } = useAdminStatus();

    // 在确认角色之前，显示加载状态
    if (loading) {
        return <div className="text-center p-8">正在載入...</div>;
    }

    // 决策点：根据角色重定向到不同的仪表板
    if (isAdmin) {
        // 如果是管理员，重定向到管理员首页
        return <Navigate to="/admin/dashboard" replace />;
    } else {
        // 如果是普通用户，重定向到用户首页
        return <Navigate to="/dashboard" replace />;
    }
};

export default LandingPage;