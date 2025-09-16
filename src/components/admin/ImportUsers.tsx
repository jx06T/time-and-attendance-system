import React, { useState } from 'react';
import { collection, query, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile } from '../../types';
import Papa from 'papaparse';

// 定义预览数据的类型，增加一个 status 字段
type PreviewUser = Partial<UserProfile> & {
    status: 'new' | 'update';
};

const ImportUsers = () => {
    // 状态管理
    const [previewData, setPreviewData] = useState<PreviewUser[]>([]);
    const [isProcessing, setIsProcessing] = useState(false); // 用于解析和写入过程
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [fileName, setFileName] = useState('');

    // 1. 处理文件选择和解析
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 重置状态
        setIsProcessing(true);
        setError('');
        setSuccess('');
        setPreviewData([]);
        setFileName(file.name);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                // 解析完成后，生成预览数据
                await generatePreview(results.data);
                setIsProcessing(false);
            },
            error: (err) => {
                setError(`CSV 解析失败: ${err.message}`);
                setIsProcessing(false);
            }
        });
    };

    // 2. 生成预览数据，并检查用户状态 (新增 vs 更新)
    const generatePreview = async (csvData: any[]) => {
        if (!csvData.length) {
            setError('CSV 文件为空或格式不正确。');
            return;
        }

        // 先获取所有现有用户的 email，用于比对
        const usersRef = collection(db, "users");
        const existingUsersSnapshot = await getDocs(query(usersRef));
        const emailSet = new Set<string>();
        existingUsersSnapshot.forEach(doc => {
            emailSet.add(doc.data().email.toLowerCase());
        });

        const preview: PreviewUser[] = csvData
            .map(row => {
                const { studentId, email, classId, seatNo, name } = row;
                if (!email || !name) return null; // 过滤掉无效行

                const lowerCaseEmail = email.toLowerCase();
                return {
                    studentId: studentId || '',
                    email: lowerCaseEmail,
                    classId: classId || '',
                    seatNo: seatNo || '',
                    name,
                    status: emailSet.has(lowerCaseEmail) ? 'update' : 'new',
                };
            })
            .filter((item) => item !== null) as PreviewUser[];

        setPreviewData(preview);
    };

    // 3. 确认汇入，执行批次写入
    const handleConfirmImport = async () => {
        if (previewData.length === 0) {
            setError('没有可汇入的资料。');
            return;
        }
        setIsProcessing(true);
        setError('');
        setSuccess('');

        try {
            const batch = writeBatch(db);
            const usersRef = collection(db, "users");

            // 同样需要获取现有用户的 email->id 映射，以便更新
            const existingUsersSnapshot = await getDocs(query(usersRef));
            const emailToIdMap = new Map<string, string>();
            existingUsersSnapshot.forEach(doc => {
                emailToIdMap.set(doc.data().email, doc.id);
            });

            previewData.forEach(user => {
                const { status, ...userData } = user; // 移除 status 字段
                const existingUserId = emailToIdMap.get(user.email!);

                if (status === 'update' && existingUserId) {
                    // 更新现有文档
                    const userDocRef = doc(db, "users", existingUserId);
                    batch.set(userDocRef, userData, { merge: true });
                } else {
                    // 创建新文档
                    const newUserDocRef = doc(usersRef);
                    batch.set(newUserDocRef, { ...userData, uid: null });
                }
            });

            await batch.commit();
            setSuccess(`成功处理 ${previewData.length} 笔资料！`);
            setPreviewData([]); // 清空预览
            setFileName('');

        } catch (err: any) {
            setError(`写入资料库时发生错误: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };


    return (
        <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-4">汇入使用者资料</h3>

            {/* 文件上传区域 */}
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center mb-6">
                <input
                    type="file"
                    id="csv-upload"
                    accept=".csv"
                    onChange={handleFileChange}
                    disabled={isProcessing}
                    className="hidden"
                />
                <label htmlFor="csv-upload" className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    选择 CSV 档案
                </label>
                {fileName && <p className="text-gray-400 mt-2">已选择: {fileName}</p>}
                <p className="text-sm text-gray-500 mt-2">
                    请确保 CSV 包含 `studentId`, `email`, `classId`, `seatNo`, `name` 栏位。
                </p>
            </div>

            {/* 状态信息 */}
            {isProcessing && <p className="text-center text-yellow-400 mb-4">处理中，请稍候...</p>}
            {error && <p className="text-center text-red-400 mb-4">{error}</p>}
            {success && <p className="text-center text-green-400 mb-4">{success}</p>}

            {/* 预览区域 */}
            {previewData.length > 0 && !isProcessing && (
                <div className="animate-fade-in">
                    <h4 className="font-bold mb-2">资料预览 ({previewData.length} 笔):</h4>
                    <div className="overflow-x-auto max-h-96 bg-gray-900 rounded">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-700 sticky top-0">
                                <tr>
                                    <th className="p-2">状态</th>
                                    <th className="p-2">Email</th>
                                    <th className="p-2">姓名</th>
                                    <th className="p-2">班级</th>
                                    <th className="p-2">座号</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewData.map((user, index) => (
                                    <tr key={index} className="border-b border-gray-700">
                                        <td className="p-2">
                                            <span className={`px-2 py-1 text-xs rounded ${user.status === 'new' ? 'bg-green-700 text-green-200' : 'bg-yellow-700 text-yellow-200'}`}>
                                                {user.status === 'new' ? '新增' : '更新'}
                                            </span>
                                        </td>
                                        <td className="p-2">{user.email}</td>
                                        <td className="p-2">{user.name}</td>
                                        <td className="p-2">{user.classId}</td>
                                        <td className="p-2">{user.seatNo}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="text-center mt-6">
                        <button
                            onClick={handleConfirmImport}
                            disabled={isProcessing}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg disabled:bg-gray-500"
                        >
                            确认汇入
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImportUsers;