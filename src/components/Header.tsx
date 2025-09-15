
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

const Header = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    return (
        <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
            <h1 className="text-xl font-bold">工業藍圖打卡系統</h1>
            <nav className="flex items-center gap-4">
                {/* 簡單的摺疊選單可以用 details 標籤實現，或先用連結 */}
                <Link to="/" className="hover:text-blue-300">打卡</Link>
                <Link to="/admin" className="hover:text-blue-300">檢視</Link>

                {user && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm">{user.displayName || user.email}</span>
                        <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-sm">
                            登出
                        </button>
                    </div>
                )}
            </nav>
        </header>
    );
};

export default Header;