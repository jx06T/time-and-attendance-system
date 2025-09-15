import { Timestamp } from "firebase/firestore";

export interface UserProfile {
  uid: string;
  name: string;
  classId: string;
  seatNo: string;
}

export interface TimeRecord {
  id?: string;
  userId: string;
  checkIn: Timestamp | null;
  checkOut: Timestamp | null;
  date: string; // YYYY-MM-DD
}