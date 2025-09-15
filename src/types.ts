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
}