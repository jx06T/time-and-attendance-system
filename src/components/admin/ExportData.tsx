import { useState } from 'react';
import { generateAndDownloadReport } from '../../utils/exportReport';
import { useToast } from '../../hooks/useToast';

const ExportData = () => {
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();

    const handleExport = async () => {
        setLoading(true);
        try {
            await generateAndDownloadReport();
            addToast('報表下載已開始', 'success');
        } catch (error: unknown) {
            console.error(error);
            addToast(`匯出失敗: ${error instanceof Error ? error.message : String(error)}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-800 p-8 rounded-lg flex flex-col items-center justify-center min-h-[300px]">
            <h2 className="text-2xl font-bold mb-4 text-white">匯出工時統計總表</h2>

            <p className="text-gray-400 mb-8 text-center max-w-lg">
                此功能將生成一份包含所有歷史紀錄的 CSV 檔案。
                <br />
                表格將自動依據日期展開，並將人員分為「學長姐」與「學弟妹」兩區塊。
            </p>

            <button
                onClick={handleExport}
                disabled={loading}
                className="
                    flex items-center gap-2
                    bg-green-600 hover:bg-green-700 text-white
                    font-bold py-3 px-6 rounded-lg text-lg shadow-lg
                    transition-all transform hover:scale-105 active:scale-95
                    disabled:bg-gray-600 disabled:cursor-not-allowed disabled:transform-none
                "
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>處理中...</span>
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>下載 CSV 報表</span>
                    </>
                )}
            </button>
        </div>
    );
};

export default ExportData;
