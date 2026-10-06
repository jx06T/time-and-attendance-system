import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBL2wqZ-Vj7vqejL23n5UL5cJ2yq2uKPBQ",
  authDomain: "cksc-attendance.firebaseapp.com",
  projectId: "cksc-attendance",
  storageBucket: "cksc-attendance.firebasestorage.app",
  messagingSenderId: "410076958022",
  appId: "1:410076958022:web:8ddd7a629740a99ef8a947",
  measurementId: "G-GP8DGYYMLF"
};


// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 匯出實例
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;