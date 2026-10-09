import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { UsersProvider } from './context/UsersContext.tsx';
import { ToastProvider } from './hooks/useToast.tsx'
import { AuthProvider } from './context/AuthContext';
import UpdateNotifier from './components/UpdateNotifier'; 
import { PwaInstallProvider } from './context/PwaInstallContext';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.error('Service worker registration failed:', error);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <UsersProvider>
            <PwaInstallProvider>
              <UpdateNotifier />
              <App />
            </PwaInstallProvider>
          </UsersProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
