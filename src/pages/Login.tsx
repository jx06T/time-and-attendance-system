import { GoogleAuthProvider, signInWithPopup, User, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, limit } from 'firebase/firestore';
import { DeviconGoogle } from '../assets/Icons';
import { useToast } from '../hooks/useToast';

const LoginPage = () => {
    const { addToast } = useToast();
    const navigate = useNavigate();
    const provider = new GoogleAuthProvider();

    const handleGoogleLogin = async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            await checkAndBindUserProfile(result.user);
            navigate('/');
        } catch (error) {
            addToast(`登入失敗: ${error.message}`, 'error')
            console.error("Google login failed", error);
            await signOut(auth);
        }
    };

    const checkAndBindUserProfile = async (user: User) => {
        if (!user.email) throw new Error("Google 帳號缺失 Email。");

        const userEmail = user.email.toLowerCase();
        const usersRef = collection(db, 'users');

        const userQuery = query(usersRef, where('email', '==', userEmail), limit(1));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            addToast(`您的資料尚未存於系統，請聯絡管理員。`, 'error')
            console.log(`系統中未找到 ${userEmail} 的個人資料。`);
            throw new Error("User profile not found.");
        }

        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();

        if (userData.uid) {
            if (userData.uid === user.uid) {
                addToast(`帳號 ${userEmail} 已經綁定，登入成功`)
                console.log(`使用者 ${userEmail} 已綁定，歡迎回來！`);
                return;
            } else {
                addToast(`此帳號 (${userEmail}) 已綁定其他 UID，請立刻聯絡管理員`)
                console.error(`安全提示： 帳號 ${userEmail} UID 已綁定為 ${userData.uid} 非 ${user.uid} （當前 UID ） 請通知管理員。`);
                throw new Error("Security alert: UID mismatch.");
            }
        } else {
            addToast(" Google 帳號綁定成功！")
            console.log(`使用者資料存在: ${userDoc.id}，正在綁定 UID...`);
            await updateDoc(doc(db, 'users', userDoc.id), {
                uid: user.uid
            });
            return;
        }
    };

    return (
        <div className="text-center max-w-2xl mx-auto p-2 tracking-wide">
            <div className=' mt-20'>
                <button onClick={handleGoogleLogin} className=" border-2 border-accent-li text-neutral font-bold py-3 px-6 rounded">
                    <DeviconGoogle className=' inline-block text-xl mb-1 mr-2' />使用 Google 登入
                </button>
            </div>
            <div className=' text-left mt-14'>
                <h1 className=' text-2xl font-bold mb-2'>
                    相關說明
                </h1>
                <ol className='list-decimal list-outside ml-5 space-y-1' >
                    <li>
                        帳號說明
                        <br />
                        此系統採用「登記制度」，建中班聯儲備/正式幹請使用建中帳號登入，其他使用者請先聯絡管理員否則無法登入
                    </li>
                    <li>
                        資料使用
                        <br />
                        透過 google 登入後，即代表同意授權此系統將您的 google 帳號與已有資料進行關聯綁定。
                    </li>
                    <li>
                        無法登入?
                        <br />
                        登入失敗請聯絡 50313tjx06@gmail.com 或詢問建中班聯活動長藍翊庭
                    </li>
                </ol>
            </div>

        </div>
    );
};

export default LoginPage;