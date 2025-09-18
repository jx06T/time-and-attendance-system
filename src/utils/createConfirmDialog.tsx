import { createRoot, Root } from 'react-dom/client';

interface ConfirmDialogOptions {
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
}

export function createConfirmDialog({
    title,
    message,
    onConfirm = () => { },
    onCancel = () => { },
    confirmText = "確認",
    cancelText = "取消"
}: ConfirmDialogOptions): void {

    const dialogContainer = document.createElement('div');
    document.body.appendChild(dialogContainer);

    const root: Root = createRoot(dialogContainer);

    const cleanup = () => {
        root.unmount();
        document.body.removeChild(dialogContainer);
    };

    const ConfirmDialogComponent = () => {
        const handleConfirm = () => {
            onConfirm();
            cleanup();
        };

        const handleCancel = () => {
            onCancel();
            cleanup();
        };

        return (
            <div className="fixed inset-0 bg-brand-d/75 flex items-center justify-center z-50 animate-fade-in px-4">
                <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-xl border border-gray-700">
                    <h3 className="text-xl font-bold mb-4 text-white">{title}</h3>
                    <p className="text-gray-300 mb-6 whitespace-pre-wrap">{message}</p>
                    <div className="flex justify-end gap-4">
                        <button
                            onClick={handleCancel}
                            className="border-2 border-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="border-2 border-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    root.render(<ConfirmDialogComponent />);
}