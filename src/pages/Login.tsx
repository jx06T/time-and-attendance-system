import { GoogleAuthProvider, signInWithPopup, User, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, limit } from 'firebase/firestore';

const LoginPage = () => {
    const navigate = useNavigate();
    const provider = new GoogleAuthProvider();

    const handleGoogleLogin = async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            await checkAndBindUserProfile(result.user);
            navigate('/');
        } catch (error) {
            console.error("Google login failed", error);
            await signOut(auth);
            alert(`登入失敗: ${error.message}`);
        }
    };

    const checkAndBindUserProfile = async (user: User) => {
        if (!user.email) throw new Error("Google 帳號缺失 Email。");

        const userEmail = user.email.toLowerCase();
        const usersRef = collection(db, 'users');

        const userQuery = query(usersRef, where('email', '==', userEmail), limit(1));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            console.log(`系統中未找到 ${userEmail} 的個人資料。`);
            alert('您的資料尚未存於系統，請聯絡管理員。');
            throw new Error("User profile not found.");
        }

        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();

        if (userData.uid) {
            if (userData.uid === user.uid) {
                console.log(`使用者 ${userEmail} 已綁定，歡迎回來！`);
                return;
            } else {
                console.error(`安全提示： 帳號 ${userEmail} UID 已綁定為 ${userData.uid} 非 ${user.uid} （當前 UID ） 請通知管理員。`);
                alert('錯誤：此帳號已綁定其他 UID');
                throw new Error("Security alert: UID mismatch.");
            }
        } else {
            console.log(`使用者資料存在: ${userDoc.id}，正在綁定 UID...`);
            await updateDoc(doc(db, 'users', userDoc.id), {
                uid: user.uid
            });
            console.log('UID 綁定成功！');
            return;
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