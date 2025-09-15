import { GoogleAuthProvider, signInWithPopup, User } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, limit } from 'firebase/firestore';

const LoginPage = () => {
    const navigate = useNavigate();
    const provider = new GoogleAuthProvider();

    const handleGoogleLogin = async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            // 登入成功後，立刻執行「查找並認領」
            await findAndClaimProfile(result.user);
            navigate('/');
        } catch (error) {
            console.error("Google login failed", error);
            // TODO: 顯示錯誤訊息給使用者
        }
    };

    // 核心的「查找並認領」函式
    const findAndClaimProfile = async (user: User) => {
        if (!user.email) return;

        // 1. 使用登入後的 email 去 `users` 集合中查詢
        const usersRef = collection(db, 'users');
        const q = query(
            usersRef,
            where('email', '==', user.email.toLowerCase()),
            where('uid', '==', null), // 2. 只查找 uid 尚未被設定的帳號
            limit(1) // 找到一個就夠了
        );

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // 3. 找到了！
            const userDoc = querySnapshot.docs[0];
            console.log(`找到了預建資料: ${userDoc.id}，正在綁定 UID...`);
            // 4. 將 Firebase Auth 的 UID 更新到這筆資料的 uid 欄位
            await updateDoc(doc(db, 'users', userDoc.id), {
                uid: user.uid
            });
            console.log('UID 綁定成功！');
        } else {
            // 沒找到預建資料。可以選擇性地處理這種情況，
            // 例如：為他建立一個新的 user profile，或者顯示錯誤訊息。
            console.log('在資料庫中未找到對應的預建資料。');
            // alert('您的帳號尚未被管理員加入系統，請聯繫管理員。');
            // await signOut(auth); // 可以選擇直接登出
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
            <button onClick={handleGoogleLogin} /* ... */>
                使用 Google 登入
            </button>
        </div>
    );
};

export default LoginPage;