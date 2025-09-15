import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBhF_wvP7PR9NW-7v279etfKuO6C_6CmRI",
    authDomain: "taas-jx.firebaseapp.com",
    projectId: "taas-jx",
    storageBucket: "taas-jx.firebasestorage.app",
    messagingSenderId: "478343899254",
    appId: "1:478343899254:web:f5774f9f2e7b36f06e1757",
    measurementId: "G-PET62WMXXH"
};


// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 匯出實例
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;