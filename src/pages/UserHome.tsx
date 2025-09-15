import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const UserHomePage = () => {
  const { user } = useAuth();

  return (
    <div className="text-center max-w-lg mx-auto">
      <h1 className="text-4xl font-bold mb-4">歡迎, {user?.displayName || '使用者'}!</h1>
      <p className="text-lg text-gray-400 mb-8">
        您可以在此查看您的個人打卡紀錄。
      </p>
      <Link
        to="/my-records"
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-xl inline-block"
      >
        查看我的打卡紀錄
      </Link>
    </div>
  );
};

export default UserHomePage;