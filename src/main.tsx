import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { UsersProvider } from './context/UsersContext.tsx';
import { ToastProvider } from './hooks/useToast.tsx'
import { AuthProvider } from './context/AuthContext';
import UpdateNotifier from './components/UpdateNotifier'; 

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <UsersProvider>
            <UpdateNotifier />
            <App />
          </UsersProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)