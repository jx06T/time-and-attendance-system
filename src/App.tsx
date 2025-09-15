import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/Home';
import LoginPage from './pages/Login';
import RecordPage from './pages/Record';
import MyRecordsPage from './pages/MyRecords';
import AdminPage from './pages/Admin';
import Layout from './layout/Layout';

import { AuthGuard } from './components/AuthGuard';
import { AdminGuard } from './components/AdminGuard';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <AuthGuard>
            <Layout />
          </AuthGuard>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/my-records" element={<MyRecordsPage />} />
      </Route>

      <Route
        element={
          <AdminGuard>
            <Layout />
          </AdminGuard>
        }
      >
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/record/:userEmail" element={<RecordPage />} />
      </Route>

    </Routes >
  );
}

export default App;