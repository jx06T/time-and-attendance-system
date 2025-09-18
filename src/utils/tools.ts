import { Timestamp } from 'firebase/firestore';

export const formatTime = (time: Timestamp | Date | null | undefined): string => {
  if (!time) {
    return 'N/A';
  }

  const date = time instanceof Timestamp ? time.toDate() : time;

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
};


export const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};