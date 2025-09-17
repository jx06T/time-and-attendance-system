import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Toast 類型定義
interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error';
    duration?: number;
}

// Context 類型定義
interface ToastContextType {
    addToast: (message: string, type?: 'success' | 'error', duration?: number) => void;
    removeToast: (id: string) => void;
}

// 創建 Context
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Toast 組件
const ToastItem = ({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onRemove(toast.id);
        }, toast.duration || 3000);

        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onRemove]);

    const handleClick = () => {
        onRemove(toast.id);
    };

    return (
        <div className={`
      relative overflow-hidden
      bg-gray-800 p-4 rounded-lg shadow-lg
      border-2 ${toast.type === 'error' ? 'border-red-500' : 'border-accent-li'}
      transform transition-all duration-300 ease-in-out
      animate-slide-down
    `}
            // onClick={handleClick}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center shrink-0">
                    {toast.type === 'error' ? (
                        <svg className="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 text-accent-li mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                    )}
                </div>
                <div>
                    <span className="text-white font-medium">{toast.message}</span>
                </div>
                <button
                    className="text-gray-400 hover:text-white transition-colors ml-4 cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleClick();
                    }}
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>

            {/* 進度條 */}
            {/* <div className="absolute bottom-0 left-0 h-1 bg-accent-li animate-progress"
                style={{
                    animationDuration: `${toast.duration || 5000}ms`,
                }}
            /> */}
        </div>
    );
};

// Toast Container 組件
const ToastContainer = ({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) => {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 space-y-3 max-w-md w-full px-4">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: 'success' | 'error' = 'success', duration: number = 5000) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newToast: Toast = { id, message, type, duration };

        setToasts(prev => [newToast, ...prev]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

// Hook
export const useToast = () => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};