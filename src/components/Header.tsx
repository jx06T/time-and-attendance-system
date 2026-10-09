import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';

import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { usePwaInstall } from '../context/PwaInstallContext';
import { useToast } from '../hooks/useToast';
import { UserRole } from '../types';
import { Menu, CiLoading } from '../assets/Icons';

function Header() {
  const { user, role, loading } = useAuth();
  const { installed, openInstall } = usePwaInstall();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => setShowMenu(false), [location.pathname, location.hash]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowMenu(false);
      navigate('/');
    } catch (error) {
      addToast(`登出失敗：${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const renderNavLinks = (closeMenu?: () => void) => {
    if (loading) return null;
    return (
      <>
        {(role === UserRole.Clocker || role === UserRole.Admin || role === UserRole.SuperAdmin) && (
          <Link onClick={closeMenu} to="/admin">打卡</Link>
        )}
        {(role === UserRole.Admin || role === UserRole.SuperAdmin) && (
          <>
            <Link onClick={closeMenu} to="/admin/batch-record">大量打卡</Link>
            <Link onClick={closeMenu} to="/admin/dashboard">管理面板</Link>
          </>
        )}
        <a onClick={closeMenu} href="https://github.com/jx06T/time-and-attendance-system">Github</a>
      </>
    );
  };

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between bg-brand-d/95 px-4 text-neutral shadow-md sm:px-8">
      <div className="group relative shrink-0">
        <Link to="/" className="text-xl font-bold group-hover:text-accent-li">打卡系統</Link>
        <div className="absolute -left-2 top-0 h-10 w-px bg-neutral group-hover:bg-accent-li" />
        <div className="absolute -bottom-1 -left-3 h-px w-28 bg-neutral group-hover:bg-accent-li" />
      </div>

      <div className="flex min-w-0 items-center gap-2 sm:gap-5">
        <nav className="hidden items-center gap-4 text-sm *:hover:text-accent-li md:flex">
          {renderNavLinks()}
          {!installed && <button type="button" onClick={openInstall} className="hover:text-accent-li">安裝 App</button>}
        </nav>

        {loading ? (
          <div className="h-8 w-20 animate-pulse rounded-md bg-gray-700 text-center"><CiLoading className="inline-block text-2xl" /></div>
        ) : user ? (
          <>
            <div className="mx-1 hidden h-6 w-px bg-neutral md:block" />
            <Link
              to="/profile"
              className="block max-w-20 min-w-0 truncate text-xs hover:text-accent-li sm:max-w-32 sm:text-sm md:max-w-36"
              title={user.displayName || user.email || undefined}
              aria-label={`前往 ${user.displayName || user.email} 的個人頁面`}
            >
              {user.displayName || user.email}
            </Link>
            <button type="button" onClick={handleLogout} className="rounded border border-red-500 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-500/10">
              登出
            </button>
          </>
        ) : (
          <Link className="rounded border border-accent-li px-2.5 py-1 text-sm text-accent-li" to="/login">登入</Link>
        )}

        <div ref={menuRef} className="relative md:hidden">
          <button
            type="button"
            aria-label="開啟選單"
            aria-expanded={showMenu}
            aria-controls="mobile-navigation"
            className="rounded p-1"
            onClick={() => setShowMenu(value => !value)}
          >
            <Menu className="text-2xl text-neutral" />
          </button>
          {showMenu && (
            <nav id="mobile-navigation" className="absolute right-0 top-11 flex w-48 flex-col rounded-lg border border-gray-700 bg-brand-d p-2 text-sm shadow-xl *:rounded *:px-3 *:py-2 *:text-left *:hover:bg-gray-700">
              {user && <Link onClick={() => setShowMenu(false)} to="/profile">我的頁面</Link>}
              {renderNavLinks(() => setShowMenu(false))}
              {!installed && (
                <button type="button" onClick={() => { setShowMenu(false); void openInstall(); }}>安裝 App</button>
              )}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
