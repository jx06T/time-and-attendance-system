import { Link, useNavigate } from 'react-router-dom';

import { useAuthStatus } from '../hooks/useAuthStatus';
import { UserRole } from '../types';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '../hooks/useToast';

import { Menu } from '../assets/Icons'

function Header() {
    const { user, role, loading } = useAuthStatus();
    const [showMenu, setShowMenu] = useState(false)
    const navigate = useNavigate();
    const { addToast } = useToast();
    const MenuRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = () => {
            // @ts-expect-error
            if (MenuRef.current && !MenuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            localStorage.removeItem('allUsers');
            localStorage.removeItem('usersLastUpdated');
            navigate('/');
        } catch (error) {
            addToast(`登入失敗：${error.message}`)
            console.error("Logout failed", error);
        }
    };

    const renderNavLinks = () => {
        if (loading) return null;

        if (role === UserRole.Admin || role === UserRole.SuperAdmin) {
            return (
                <>
                    <Link to="/admin/dashboard">打卡</Link>
                    <Link to="/admin/reports">管理面板</Link>
                    <a className='' href="https://github.com/jx06T/time-and-attendance-system">Github</a>
                </>
            );
        }

        return <a className='' href="https://github.com/jx06T/time-and-attendance-system">Github</a>
    };


    return (
        <header className="bg-brand-d/95 text-neutral p-3 px-6 sm:px-8 h-14 flex justify-between items-center shadow-md fixed top-0 left-0 right-0 z-30">
            <div className=' relative group'>
                <Link to="/" className="text-xl font-bold group-hover:text-accent-li">
                    打卡系統
                </Link>
                <div className=' absolute top-0 -left-2 bg-neutral group-hover:bg-accent-li w-[1.5px] h-10' ></div>
                <div className=' absolute -bottom-1 -left-3 bg-neutral group-hover:bg-accent-li w-28 h-[1.5px]' ></div>
            </div>

            <div className="flex items-center gap-6 ">
                <nav className=" hidden md:flex items-center gap-4 text-sm *:hover:text-accent-li">
                    {renderNavLinks()}
                </nav>
                {user ? (
                    <>
                        <div className=' hidden md:block bg-neutral w-[1px] -mx-3 h-6' >
                        </div>
                        <div className="flex items-center gap-3 ">
                            <Link to="/profile" className="text-sm hover:text-accent-li">{user.displayName || user.email}</Link>
                            <button
                                onClick={handleLogout}
                                className=" border-2 border-red-500 text-red-400 cursor-pointer px-3 py-1.5 rounded text-sm transition-colors"
                            >
                                登出
                            </button>
                        </div>
                    </>
                ) :
                    <Link className=" border-2 border-accent-li text-accent-li cursor-pointer px-3 py-1.5 rounded text-sm transition-colors" to="/login">登入</Link>}

                <button ref={MenuRef} className=' md:hidden block -mx-2' onClick={() => setShowMenu(!showMenu)}>
                    <Menu className=' text-neutral text-3xl' />
                </button>
            </div>
            <div className={`md:hidden absolute right-0 top-14 bg-brand-d/95 ${showMenu ? " max-h-96" : " max-h-0"} overflow-hidden transition-[max-height] duration-300`}>
                <nav className={`flex flex-col items-start gap-0 text-sm *:hover:text-accent-li *:pb-4 *:pt-2 *:px-4 *:w-full `}>
                    {renderNavLinks()}
                </nav>

            </div>
        </header>
    );
};
export default Header;
