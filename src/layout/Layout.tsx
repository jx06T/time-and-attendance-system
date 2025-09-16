import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
interface LayoutProps {
    children?: React.ReactNode;
}

function Layout({ children }: LayoutProps) {
    return (
        <div className="min-h-screen text-neutral-100 grid-background">
            <Header />
            <main className="px-2 sm:px-8 md:px-16 lg:px-[calc(2%+4rem)] pt-8">
                {children || <Outlet />}
            </main>
        </div>
    );
};

export default Layout;