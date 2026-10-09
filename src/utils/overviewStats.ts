import type { TimeRecord, UserProfile } from '../types';
import { toLocalDateString } from './tools';

export interface WeeklyTrendPoint {
  weekStart: string;
  hours: number;
}

export interface OverviewStats {
  weekStart: string;
  rosterCount: number;
  attendeeCount: number;
  absentCount: number;
  totalHours: number;
  averageHours: number;
  pendingRecordCount: number;
  juniorHours: number;
  seniorHours: number;
  otherHours: number;
  trend: WeeklyTrendPoint[];
}

function mondayOf(date: Date) {
  const monday = new Date(date);
  const weekday = monday.getDay();
  monday.setDate(monday.getDate() - (weekday === 0 ? 6 : weekday - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function hoursFor(record: TimeRecord) {
  if (!record.checkIn || !record.checkOut) return 0;
  const deductionMinutes = Number(record.deductionMinutes) || 0;
  const milliseconds = record.checkOut.toMillis() - record.checkIn.toMillis() - deductionMinutes * 60_000;
  return Number.isFinite(milliseconds) ? Math.max(0, milliseconds / 3_600_000) : 0;
}

export function calculateOverviewStats(users: UserProfile[], records: TimeRecord[], todayDate: string): OverviewStats {
  const today = new Date(`${todayDate}T12:00:00`);
  const currentMonday = mondayOf(today);
  const weekStart = toLocalDateString(currentMonday);
  const roster = new Map(users.filter(user => user.email).map(user => [user.email.toLowerCase(), user]));

  const trend = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(currentMonday);
    date.setDate(date.getDate() - (8 - index) * 7);
    return { weekStart: toLocalDateString(date), hours: 0 };
  });
  const trendByWeek = new Map(trend.map(point => [point.weekStart, point]));
  const attendees = new Set<string>();
  let totalHours = 0;
  let pendingRecordCount = 0;
  let juniorHours = 0;
  let seniorHours = 0;
  let otherHours = 0;

  records.forEach(record => {
    const email = record.userEmail?.toLowerCase();
    const member = email ? roster.get(email) : undefined;
    if (!member || !/^\d{4}-\d{2}-\d{2}$/.test(record.date) || record.date > todayDate) return;

    const hours = hoursFor(record);
    if (record.date >= weekStart) {
      if (record.checkIn) {
        attendees.add(email);
        if (!record.checkOut) pendingRecordCount++;
      }
      totalHours += hours;
      const grade = member.classId?.trim().charAt(0);
      if (grade === '1') juniorHours += hours;
      else if (grade === '2' || grade === '3') seniorHours += hours;
      else otherHours += hours;
    } else {
      const recordDate = new Date(`${record.date}T12:00:00`);
      if (Number.isNaN(recordDate.getTime())) return;
      const trendPoint = trendByWeek.get(toLocalDateString(mondayOf(recordDate)));
      if (trendPoint) trendPoint.hours += hours;
    }
  });

  return {
    weekStart,
    rosterCount: roster.size,
    attendeeCount: attendees.size,
    absentCount: Math.max(0, roster.size - attendees.size),
    totalHours,
    averageHours: attendees.size > 0 ? totalHours / attendees.size : 0,
    pendingRecordCount,
    juniorHours,
    seniorHours,
    otherHours,
    trend,
  };
}
