// src/components/common/UpdateNotifier.tsx

import { useEffect } from 'react';
import { useToast } from '../hooks/useToast';
import useLocalStorage from '../hooks/useLocalStorage'; // 確保路徑正確

export const versionLog = {
    '1.3.1': '儀表板功能更新了!現在可以篩選指定時數以下(上)的紀錄，並可以直接點擊前往該使用者的詳細記錄',
};

export const LATEST_VERSION = '1.3.1';

const UpdateNotifier = () => {
    const { addToast } = useToast();
    const [lastSeenVersion, setLastSeenVersion] = useLocalStorage<string>('lastSeenVersion', '0.0.0');

    useEffect(() => {
        // 檢查儲存在 localStorage 的版本號是否與當前最新版本不同
        if (lastSeenVersion !== LATEST_VERSION) {
            const message = versionLog[LATEST_VERSION as keyof typeof versionLog];
            if (message) {
                // 如果找到了對應的更新訊息，就顯示一個持續時間較長的 toast
                addToast(
                    `✨ 版本更新：${message}`,
                    'success',
                    10000 // 顯示 10 秒，讓使用者有足夠時間閱讀
                );
            }

            // 無論是否有訊息，都將 localStorage 的版本號更新為最新版
            // 這樣使用者下次打開就不會再看到這個通知了
            setLastSeenVersion(LATEST_VERSION);
        }
    }, [addToast, lastSeenVersion, setLastSeenVersion]);

    return null;
};

export default UpdateNotifier;