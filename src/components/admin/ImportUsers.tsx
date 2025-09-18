import React, { useState } from 'react';
import { collection, query, setDoc, getDocs, where, writeBatch, doc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile } from '../../types';
import Papa from 'papaparse';
import { useUsers } from '../../context/UsersContext';
import { useToast } from '../../hooks/useToast';
import { createConfirmDialog } from '../../utils/createConfirmDialog';

type PreviewUser = Partial<UserProfile> & {
    status: 'new' | 'update';
    previewId: number;
};

const initialFormState = { studentId: '', email: '', classId: '', seatNo: '', name: '' };

function ImportUsers() {
    // --- for 批量導入 ---
    const [previewData, setPreviewData] = useState<PreviewUser[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [fileName, setFileName] = useState('');

    // --- for 手動輸入 ---
    const [isManualFormExpanded, setIsManualFormExpanded] = useState(false);
    const [manualForm, setManualForm] = useState(initialFormState);
    const [manualSubmitLoading, setManualSubmitLoading] = useState(false);

    const { allUsers } = useUsers();
    const { addToast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setPreviewData([]);
        setFileName(file.name);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                await generatePreview(results.data);
                setIsProcessing(false);
            },
            error: (err) => {
                addToast(`CSV 解析失敗: ${err.message}`, 'error');
                setIsProcessing(false);
            }
        });
    };

    const generatePreview = async (csvData: any[]) => {
        if (!csvData.length) {
            addToast('CSV 文件為空或格式錯誤。', 'error');
            return;
        }

        const emailSet = new Set<string>();
        allUsers.forEach(user => emailSet.add(user.email.toLowerCase()));

        const preview: PreviewUser[] = csvData
            .map((row, index) => {
                const { studentId, email, classId, seatNo, name } = row;
                if (!email || !name) return null;
                const lowerCaseEmail = email.toLowerCase();
                return {
                    studentId: studentId || '',
                    email: lowerCaseEmail,
                    classId: classId || '',
                    seatNo: seatNo || '',
                    name,
                    status: emailSet.has(lowerCaseEmail) ? 'update' : 'new',
                    previewId: index, // 臨時id
                };
            })
            .filter((item) => item !== null) as PreviewUser[];

        if (!preview || preview.length === 0) {
            addToast('CSV 文件為空或格式錯誤。', 'error');
        }
        setPreviewData(preview);
    };

    const handleRemoveFromPreview = (idToRemove: number) => {
        setPreviewData(currentPreview => currentPreview.filter(user => user.previewId !== idToRemove));
    };

    const handleConfirmImport = async () => {
        if (previewData.length === 0) {
            addToast('沒有可匯入資料', 'error');
            return;
        }
        setIsProcessing(true);
        try {
            const batch = writeBatch(db);
            const usersRef = collection(db, "users");

            const emailToIdMap = new Map<string, string>();
            allUsers.forEach(user => emailToIdMap.set(user.email.toLowerCase(), user.id));

            previewData.forEach(user => {
                const { status, previewId, ...userData } = user;
                const existingUserId = emailToIdMap.get(user.email!);

                if (status === 'update' && existingUserId) {
                    const userDocRef = doc(db, "users", existingUserId);
                    batch.set(userDocRef, userData, { merge: true });
                } else {
                    const newUserDocRef = doc(usersRef);
                    batch.set(newUserDocRef, { ...userData, uid: null });
                }
            });

            await batch.commit();
            addToast(`成功處理 ${previewData.length} 筆資料！`);
            setPreviewData([]);
            setFileName('');
        } catch (err: any) {
            addToast(`寫入資料庫時發生錯誤: ${err.message}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { email, name, studentId, seatNo, classId } = manualForm;
        if (!email || !name || !studentId || !seatNo || !classId) {
            addToast("資料不完整。", 'error');
            return;
        }

        setManualSubmitLoading(true);
        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("email", "==", email.toLowerCase()));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const existingDoc = querySnapshot.docs[0];
                createConfirmDialog({
                    title: "更新使用者資料",
                    message: `Email "${email}" 已存在於系统中 (姓名: ${existingDoc.data().name})。\n您確定要用現在輸入的新資料覆蓋它嗎？`,
                    onConfirm: async () => {
                        const userDocRef = doc(db, "users", existingDoc.id);
                        await setDoc(userDocRef, {
                            ...manualForm,
                            email: email
                        }, { merge: true });

                        addToast(`成功更新使用者: ${name}`, 'success');
                    },
                    onCancel: () => { },
                    confirmText: "覆蓋",
                    cancelText: "取消"
                });

                return;
            }
            await addDoc(usersRef, { ...manualForm, email: email.toLowerCase(), uid: null });
            addToast(`成功新增使用者: ${name}`);
            setManualForm(initialFormState);
            setIsManualFormExpanded(false);
        } catch (err: any) {
            addToast(`新增失敗: ${err.message}`, 'error');
        } finally {
            setManualSubmitLoading(false);
        }
    };

    return (
        <>
            <div className="bg-gray-800 p-6 rounded-lg">
                <div className="mb-8">
                    <button onClick={() => setIsManualFormExpanded(!isManualFormExpanded)} className="w-full flex justify-between items-center text-left text-lg font-bold text-accent-li cursor-pointer transition-colors">
                        <span>手動新增</span>
                        <span className={`transform transition-transform duration-200 ${isManualFormExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {isManualFormExpanded && (
                        <form onSubmit={handleManualSubmit} className="mt-4 p-4 bg-gray-900 rounded-lg animate-fade-in space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-gray-400 mb-1">姓名*</label><input type="text" required value={manualForm.name} onChange={e => setManualForm({ ...manualForm, name: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600" /></div>
                                <div><label className="block text-sm font-medium text-gray-400 mb-1">Email*</label><input type="email" required value={manualForm.email} onChange={e => setManualForm({ ...manualForm, email: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600" /></div>
                                <div><label className="block text-sm font-medium text-gray-400 mb-1">學號*</label><input type="text" required value={manualForm.studentId} onChange={e => setManualForm({ ...manualForm, studentId: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600" /></div>
                                <div><label className="block text-sm font-medium text-gray-400 mb-1">班級*</label><input type="text" value={manualForm.classId} onChange={e => setManualForm({ ...manualForm, classId: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600" /></div>
                                <div><label className="block text-sm font-medium text-gray-400 mb-1">座號*</label><input type="text" value={manualForm.seatNo} onChange={e => setManualForm({ ...manualForm, seatNo: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600" /></div>
                            </div>
                            <div className="text-right pt-2">
                                <button type="submit" disabled={manualSubmitLoading} className="border-2 border-accent-li text-accent-li cursor-pointer font-bold py-2 px-4 rounded disabled:bg-gray-500 disabled:cursor-not-allowed">
                                    {manualSubmitLoading ? '新增中...' : '新增'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <div className="border-t border-gray-700 pt-8">
                    <h3 className="text-xl font-bold mb-4">批量匯入使用者資料 (CSV)</h3>
                    <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center mb-6">
                        <input type="file" id="csv-upload" accept=".csv" onChange={handleFileChange} disabled={isProcessing} className="hidden" />
                        <label htmlFor="csv-upload" className="inline-block cursor-pointer font-bold mb-2 py-2 px-4 border-2 border-accent-li text-accent-li rounded">選擇 CSV 檔案</label>
                        {fileName && <p className="text-gray-400 mt-2">目前檔案：{fileName}</p>}
                        <p className="text-sm text-gray-500 mt-2">請確保 CSV 包含 `studentId`, `email`, `classId`, `seatNo`, `name` 欄位。</p>
                    </div>

                    {isProcessing && <p className="text-center text-neutral mb-4">處理中...</p>}
                    {previewData.length > 0 && !isProcessing && (
                        <div className="animate-fade-in">
                            <h4 className="font-bold mb-2">預覽資料 ({previewData.length} 筆):</h4>
                            <div className="overflow-x-auto max-h-96 bg-gray-900 rounded">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-700 sticky top-0">
                                        <tr>
                                            <th className="p-3 px-4">狀態</th><th className="p-3 px-4">Email</th><th className="p-3 px-4">班級</th><th className="p-3 px-4">座號</th><th className="p-3 px-4">姓名</th><th className="p-3 px-4">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.map((user) => (
                                            <tr key={user.previewId}>
                                                <td className="p-3 px-4"><span className={`rounded ${user.status === 'new' ? 'text-green-500' : ' text-accent-li'}`}>{user.status === 'new' ? '新增' : '更新'}</span></td>
                                                <td className="p-3 px-4">{user.email}</td><td className="p-3 px-4">{user.classId}</td><td className="p-3 px-4">{user.seatNo}</td><td className="p-3 px-4">{user.name}</td>
                                                <td className="p-3 px-4"><button onClick={() => handleRemoveFromPreview(user.previewId)} className="text-red-500 cursor-pointer">移除</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="text-center mt-6">
                                <button onClick={handleConfirmImport} disabled={isProcessing} className="border-2 border-accent-li text-accent-li font-bold py-2 px-4 rounded text-lg disabled:bg-gray-500 disabled:cursor-not-allowed">確認批量匯入</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className=' w-full h-32'></div>
        </>
    );
};

export default ImportUsers;