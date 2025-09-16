import { Timestamp } from "firebase/firestore";

export interface UserProfile {
    id: string;
    uid: string | null;
    name: string;
    classId: string;
    seatNo: string;
    email: string
    studentId: string
}

export interface TimeRecord {
    id?: string;
    userEmail: string;
    checkIn: Timestamp | null;
    checkOut: Timestamp | null;
    date: string; // YYYY-MM-DD
    deductionMinutes?: number;
    notes?: string;
}

export enum UserRole {
    Visitor = 'visitor',      // 未登入
    User = 'user',            // 已登入的普通用户
    Admin = 'admin',          // 管理员
    SuperAdmin = 'superadmin' // 最高管理者
}
