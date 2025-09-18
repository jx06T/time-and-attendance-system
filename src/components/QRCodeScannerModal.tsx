import { useEffect, useRef } from 'react';
import {
    Html5QrcodeScanner,
    QrcodeErrorCallback,
    QrcodeSuccessCallback,
    Html5QrcodeSupportedFormats
} from 'html5-qrcode';

interface QRCodeScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScanSuccess: (decodedText: string) => void;
    onScanError?: (errorMessage: string) => void;
}

const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    rememberLastUsedCamera: true,
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    cameraConstraints: { facingMode: "environment" }
};

const QRCodeScannerModal = ({ isOpen, onClose, onScanSuccess, onScanError }: QRCodeScannerModalProps) => {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);
    // 使用 ref 來儲存最新的回調函式
    const callbacksRef = useRef({ onScanSuccess, onScanError });

    // 確保 ref 中的回調總是最新的
    useEffect(() => {
        callbacksRef.current = { onScanSuccess, onScanError };
    }, [onScanSuccess, onScanError]);

    useEffect(() => {
        if (isOpen) {
            if (!scannerRef.current) {
                const scanner = new Html5QrcodeScanner("reader", config, false);

                const handleSuccess: QrcodeSuccessCallback = (decodedText, decodedResult) => {
                    // 從 ref 中調用最新的回調
                    callbacksRef.current.onScanSuccess(decodedText);
                };

                const handleError: QrcodeErrorCallback = (errorMessage) => {
                    if (callbacksRef.current.onScanError) {
                        callbacksRef.current.onScanError(errorMessage);
                    }
                };

                scanner.render(handleSuccess, handleError);
                scannerRef.current = scanner;
            }
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(error => {
                    console.error("Failed to clear scanner on cleanup.", error);
                });
                scannerRef.current = null;
            }
        };
        // useEffect 只依賴 isOpen。
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-gray-700/60 flex flex-col items-center justify-center z-50 pb-6">
            <div className="bg-gray-800 rounded-md overflow-hidden w-full max-w-lg m-4 p-3 py-4 pb-2 shadow-lg">
                <div id="reader" className="w-full /max-h-[60vh]"></div>
                <p className="text-white text-center p-3 py-2 mb-2">請將 QR Code 對準掃描框</p>
            </div>
            <button
                onClick={onClose}
                className="mt-2 border-2 border-accent-li text-accent-li font-bold py-2 px-4 rounded transition-colors hover:bg-gray-700"
            >
                關閉
            </button>
        </div>
    );
};

export default QRCodeScannerModal;