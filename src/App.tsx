import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/Landing';
import ProfilePage from './pages/Profile';
import AdminHomePage from './pages/AdminHome';
import LoginPage from './pages/Login';
import RecordPage from './pages/Record';
import RPage from './pages/R';
import AdminPage from './pages/Admin';
import Layout from './layout/Layout';
import NotFoundPage from './pages/NotFound';

import { UserRole } from './types';
import { AuthorizationGuard } from './components/AuthorizationGuard';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/r/:userEmail" element={<RPage />} />
      </Route>

      <Route
        element={
          <AuthorizationGuard
            allowedRoles={[UserRole.User, UserRole.Clocker, UserRole.Admin, UserRole.SuperAdmin]}
          />
        }
      >
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route
        element={
          <AuthorizationGuard
            allowedRoles={[UserRole.Clocker, UserRole.Admin, UserRole.SuperAdmin]}
          />
        }
      >
        <Route path="/admin" element={<AdminHomePage />} />
        <Route path="/admin/record/:userEmail" element={<RecordPage />} />
      </Route>

      <Route
        element={
          <AuthorizationGuard
            allowedRoles={[UserRole.Admin, UserRole.SuperAdmin]}
          />
        }
      >
        <Route path="/admin/dashboard" element={<AdminPage />} />
      </Route>

      <Route path='*' element={<Layout><NotFoundPage /></Layout>} />
    </Routes >
  );
}

export default App;