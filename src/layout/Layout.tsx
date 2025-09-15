import { Outlet } from 'react-router-dom';
import Header from './Header';

const Layout = () => {
  return (
    <div className="min-h-screen bg-blue-900 text-gray-200 font-mono">
      <Header />
      <main className="p-8">
        <Outlet /> 
      </main>
    </div>
  );
};

export default Layout;