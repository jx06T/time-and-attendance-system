import { collection, getDocs } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { TimeRecord, UserProfile } from '../types';
import { toLocalDateString } from './tools';

const calculateHours = (start: Timestamp | null, end: Timestamp | null, deduction = 0): number => {
    if (!start || !end) return 0;
    const durationMs = end.toMillis() - start.toMillis() - deduction * 60_000;
    return Math.round(Math.max(0, durationMs / 3_600_000) * 100) / 100;
};

const escapeCsvCell = (value: string): string => {
    // Quoting keeps commas, quotes and newlines in one cell. The apostrophe
    // prevents spreadsheet applications from evaluating imported profile text.
    const safeValue = /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(safeValue)
        ? `"${safeValue.replace(/"/g, '""')}"`
        : safeValue;
};

export const generateAndDownloadReport = async (): Promise<void> => {
    const [usersSnap, recordsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'timeRecords')),
    ]);

    const users = usersSnap.docs.map(doc => doc.data() as UserProfile);
    const records = recordsSnap.docs.map(doc => doc.data() as TimeRecord);
    const allDates = Array.from(new Set(records.map(record => record.date))).sort();
    const hoursByEmailAndDate = new Map<string, number>();

    for (const record of records) {
        hoursByEmailAndDate.set(
            `${record.userEmail}_${record.date}`,
            calculateHours(record.checkIn, record.checkOut, record.deductionMinutes ?? 0),
        );
    }

    const sortedUsers = [...users].sort((a, b) =>
        String(a.classId ?? '').localeCompare(String(b.classId ?? '')) ||
        Number(a.seatNo) - Number(b.seatNo),
    );
    const seniors = sortedUsers.filter(user => !String(user.classId ?? '').startsWith('1'));
    const juniors = sortedUsers.filter(user => String(user.classId ?? '').startsWith('1'));

    const rows: string[][] = [['群組', '班級', '座號', '姓名', ...allDates, '總時數']];
    const addUserRow = (user: UserProfile, group: string) => {
        let totalHours = 0;
        const dailyHours = allDates.map(date => {
            const hours = hoursByEmailAndDate.get(`${user.email}_${date}`) ?? 0;
            totalHours += hours;
            return hours === 0 ? '' : hours.toFixed(2);
        });

        rows.push([
            group,
            String(user.classId ?? ''),
            String(user.seatNo ?? ''),
            user.name,
            ...dailyHours,
            totalHours.toFixed(2),
        ]);
    };

    seniors.forEach(user => addUserRow(user, '學長姐(非1開頭)'));
    juniors.forEach(user => addUserRow(user, '學弟妹(1開頭)'));

    const csv = rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `工時統計報表_${toLocalDateString(new Date())}.csv`;
    document.body.appendChild(link);

    try {
        link.click();
    } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
};
