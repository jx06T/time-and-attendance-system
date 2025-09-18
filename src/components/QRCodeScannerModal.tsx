import { useEffect } from 'react';
import { Html5QrcodeScanner, QrcodeErrorCallback, QrcodeSuccessCallback } from 'html5-qrcode';

interface QRCodeScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScanSuccess: (decodedText: string) => void;
    onScanError?: (errorMessage: string) => void;
}

const QRCodeScannerModal = ({ isOpen, onClose, onScanSuccess, onScanError }: QRCodeScannerModalProps) => {
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const scanner = new Html5QrcodeScanner(
            "reader", // div ID
            {
                qrbox: {
                    width: 250,
                    height: 250,
                },
                fps: 10, // 每秒掃描幀數
                rememberLastUsedCamera: true,
            },
            false // verbose
        );

        const handleSuccess: QrcodeSuccessCallback = (decodedText, decodedResult) => {
            // 為了避免重複觸發，成功後立即清理
            scanner.clear().catch(error => {
                console.error("Failed to clear scanner.", error);
            });
            onScanSuccess(decodedText);
        };

        const handleError: QrcodeErrorCallback = (errorMessage) => {
            if (onScanError) {
                onScanError(errorMessage);
            }
        };

        scanner.render(handleSuccess, handleError);

        // Cleanup function: 組件卸載或 isOpen 變為 false 時停止相機
        return () => {
            // 確保 scanner 實例存在且處於掃描狀態
            if (scanner && scanner.getState()) {
                scanner.clear().catch(error => {
                    console.error("Failed to clear scanner on cleanup.", error);
                });
            }
        };
    }, [isOpen, onScanSuccess, onScanError]); // 依賴 isOpen 來啟動或停止

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-gray-700/60  flex flex-col items-center justify-center z-50">
            <div className="bg-gray-800 rounded-md overflow-hidden w-full max-w-lg m-4 p-3 py-4 pb-2">
                <div id="reader" className="w-full"></div>
                <p className="text-white text-center p-3">請將 QR Code 對準掃描框</p>
            </div>
            <button
                onClick={onClose}
                className="mt-4 border-2 border-accent-li text-accent-li font-bold py-2 px-4 rounded"
            >
                關閉
            </button>
        </div>
    );
};

export default QRCodeScannerModal;