import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/Landing';
import ProfilePage from './pages/Profile';
import AdminHomePage from './pages/AdminHome';
import LoginPage from './pages/Login';
import RecordPage from './pages/Record';
import AdminPage from './pages/Admin';
import Layout from './layout/Layout';
import NotFoundPage from './pages/NotFound';

import { AuthGuard } from './components/AuthGuard';
import { AdminGuard } from './components/AdminGuard';


function App() {
  return (
    <Routes>
      <Route path="/login" element={<Layout><LoginPage /></Layout>} />
      <Route path="/" element={<Layout><LandingPage /> </Layout>} />

      <Route
        element={
          <AuthGuard>
            <Layout />
          </AuthGuard>
        }
      >
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route
        element={
          <AdminGuard>
            <Layout />
          </AdminGuard>
        }
      >
        <Route path="/admin" element={<AdminHomePage />} />
        <Route path="/admin/dashboard" element={<AdminHomePage />} />
        <Route path="/admin/reports" element={<AdminPage />} />
        <Route path="/admin/record/:userEmail" element={<RecordPage />} />
      </Route>

      <Route path='*' element={<Layout><NotFoundPage /></Layout>} />
    </Routes >
  );
}

export default App;