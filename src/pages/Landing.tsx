import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; 
import { UserRole } from '../types';
import TopThreeChart from '../components/TopThreeChart';


const LandingPage = () => {
    const { user, role, loading } =  useAuth();

    const renderAction = () => {
        if (loading) {
            return (
                <div className="bg-gray-700 h-16 w-64 mx-auto rounded-lg animate-pulse"></div>
            );
        }

        if (role === UserRole.Admin || role === UserRole.Clocker  || role === UserRole.SuperAdmin) {
            return (
                <Link
                    to="/admin"
                    className="border-2 border-accent-li text-accent-li cursor-pointer font-bold py-4 px-10 rounded-lg text-xl inline-block"
                >
                    進行打卡操作
                </Link>
            );
        }

        if (role === UserRole.User) {
            return (
                <Link
                    to="/profile"
                    className="border-2 border-accent-li text-accent-li cursor-pointer font-bold py-4 px-10 rounded-lg text-xl inline-block"
                >
                    進入我的主頁
                </Link>
            );
        }

        return (
            <Link
                to="/login"
                className="border-2 border-accent-li text-accent-li cursor-pointer font-bold py-4 px-10 rounded-lg text-xl inline-block"
            >
                登入以開始
            </Link>
        );
    };

    return (
        <div className="text-center max-w-2xl mx-auto p-2 px-4 tracking-wide">
            <h1 className="text-5xl font-bold mb-4 leading-16 tracking-wider">
                歡迎來到<br />場佈打卡系統
            </h1>
            <p className="text-lg text-gray-200 mb-12 tracking-wider">
                {(user && user.displayName) ? `你好, ${user.displayName}！` : '一個現代化的出缺席管理解決方案。'}
            </p>

            {renderAction()}
            <div className=' mt-20 text-left space-y-9 mb-24'>
                <div>
                    <h1 className=' text-2xl font-bold mb-2'>
                        關於此系統
                    </h1>
                    此系統功依照使用者權限具有以下功能：
                    <ol className='list-decimal list-outside ml-6 space-y-1 mt-1.5 ' >
                        <li>
                            公開頁面
                            <br />
                            專案功能說明、當週出缺排名展示、登入入口
                        </li>
                        <li>
                            一般使用者頁面
                            <br />
                            個人儀表板（查看個人基本資料以及打卡紀錄）
                        </li>
                        <li>
                            管理頁面
                            <br />
                            簽到簽退操作、編輯打卡紀錄 (可補登、修改時間、註記扣時與事由)、查看團隊週報/單人月報表、使用者資料與權限管理
                        </li>
                    </ol>

                </div>
                <div>
                    <h1 className=' text-2xl font-bold mb-2'>
                        開源
                    </h1>
                    <p>此系統採用 MIT 協議開源，詳細規範請見 Github 儲存庫</p>
                    <a className=' decoration-accent-li underline underline-offset-2' href="https://github.com/jx06T/time-and-attendance-system">儲存庫連結</a>
                </div>
                <div>
                    <h1 className=' text-2xl font-bold mb-3'>
                        排行榜
                    </h1>
                    <TopThreeChart />
                </div>
            </div>
        </div>
    );
};

export default LandingPage;