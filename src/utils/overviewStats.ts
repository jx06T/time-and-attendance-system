import type { TimeRecord, UserProfile } from '../types';
import { toLocalDateString } from './tools';

export type OverviewGroupKey = 'junior' | 'senior' | 'other';

export interface GroupOverview {
  rosterCount: number;
  attendeeCount: number;
  absentCount: number;
  totalHours: number;
  averageWeeklyHours: number;
  averageDailyHours: number;
  averageAttendanceDays: number;
  attendanceDays: number;
  pendingRecordCount: number;
  twoWeekNoRecordCount: number;
}

export interface TopWorker {
  email: string;
  name: string;
  classId: string;
  hours: number;
}

export interface OverviewStats {
  weekStart: string;
  lastWeekStart: string;
  lastWeekSameDay: string;
  totalHours: number;
  lastWeekTotalHours: number;
  lastWeekTotalHoursByGroup: Record<OverviewGroupKey, number>;
  lastWeekToDateHours: number;
  lastWeekToDateHoursByGroup: Record<OverviewGroupKey, number>;
  sameDayChangePercent: number | null;
  sameDayChangePercentByGroup: Record<OverviewGroupKey, number | null>;
  pendingRecordCount: number;
  twoWeekNoRecordCount: number;
  groups: Record<OverviewGroupKey, GroupOverview>;
  topWorkers: TopWorker[];
}

interface GroupAccumulator {
  rosterCount: number;
  attendees: Set<string>;
  attendanceDays: Set<string>;
  completedDays: Set<string>;
  totalHours: number;
  pendingRecordCount: number;
  twoWeekNoRecordCount: number;
}

function mondayOf(date: Date) {
  const monday = new Date(date);
  const weekday = monday.getDay();
  monday.setDate(monday.getDate() - (weekday === 0 ? 6 : weekday - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function dateOffset(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return toLocalDateString(result);
}

function groupFor(user: UserProfile): OverviewGroupKey {
  const grade = user.classId?.trim().charAt(0);
  if (grade === '1') return 'junior';
  if (grade === '2' || grade === '3') return 'senior';
  return 'other';
}

function hoursFor(record: TimeRecord) {
  if (!record.checkIn || !record.checkOut) return 0;
  const deductionMinutes = Number(record.deductionMinutes) || 0;
  const milliseconds = record.checkOut.toMillis() - record.checkIn.toMillis() - deductionMinutes * 60_000;
  return Number.isFinite(milliseconds) ? Math.max(0, milliseconds / 3_600_000) : 0;
}

function changePercent(current: number, previous: number) {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

function newGroup(): GroupAccumulator {
  return {
    rosterCount: 0,
    attendees: new Set(),
    attendanceDays: new Set(),
    completedDays: new Set(),
    totalHours: 0,
    pendingRecordCount: 0,
    twoWeekNoRecordCount: 0,
  };
}

function summarizeGroup(group: GroupAccumulator): GroupOverview {
  return {
    rosterCount: group.rosterCount,
    attendeeCount: group.attendees.size,
    absentCount: Math.max(0, group.rosterCount - group.attendees.size),
    totalHours: group.totalHours,
    averageWeeklyHours: group.attendees.size ? group.totalHours / group.attendees.size : 0,
    averageDailyHours: group.completedDays.size ? group.totalHours / group.completedDays.size : 0,
    averageAttendanceDays: group.attendees.size ? group.attendanceDays.size / group.attendees.size : 0,
    attendanceDays: group.attendanceDays.size,
    pendingRecordCount: group.pendingRecordCount,
    twoWeekNoRecordCount: group.twoWeekNoRecordCount,
  };
}

export function calculateOverviewStats(users: UserProfile[], records: TimeRecord[], todayDate: string): OverviewStats {
  const today = new Date(`${todayDate}T12:00:00`);
  const currentMonday = mondayOf(today);
  const weekStart = toLocalDateString(currentMonday);
  const lastWeekStart = dateOffset(currentMonday, -7);
  const lastWeekSameDay = dateOffset(today, -7);
  const twoWeeksAgoStart = dateOffset(currentMonday, -14);

  const roster = new Map(users.filter(user => user.email?.trim()).map(user => [user.email.trim().toLowerCase(), user]));
  const groups: Record<OverviewGroupKey, GroupAccumulator> = {
    junior: newGroup(), senior: newGroup(), other: newGroup(),
  };
  roster.forEach(user => { groups[groupFor(user)].rosterCount++; });

  const peopleWithRecordsInLastTwoWeeks = new Set<string>();
  const workerHours = new Map<string, number>();
  let totalHours = 0;
  let lastWeekTotalHours = 0;
  const lastWeekTotalHoursByGroup = { junior: 0, senior: 0, other: 0 };
  let lastWeekToDateHours = 0;
  const lastWeekToDateHoursByGroup = { junior: 0, senior: 0, other: 0 };
  let pendingRecordCount = 0;

  records.forEach(record => {
    const email = record.userEmail?.trim().toLowerCase();
    const member = email ? roster.get(email) : undefined;
    if (!member || !/^\d{4}-\d{2}-\d{2}$/.test(record.date) || record.date < twoWeeksAgoStart || record.date > todayDate) return;

    const groupKey = groupFor(member);
    const hours = hoursFor(record);
    if (record.date >= twoWeeksAgoStart && record.date < weekStart) {
      peopleWithRecordsInLastTwoWeeks.add(email);
    }

    if (record.date >= weekStart) {
      if (record.checkIn) {
        groups[groupKey].attendees.add(email);
        groups[groupKey].attendanceDays.add(`${email}:${record.date}`);
        if (record.checkOut) groups[groupKey].completedDays.add(`${email}:${record.date}`);
        else {
          groups[groupKey].pendingRecordCount++;
          pendingRecordCount++;
        }
      }
      groups[groupKey].totalHours += hours;
      totalHours += hours;
      if (hours > 0) workerHours.set(email, (workerHours.get(email) || 0) + hours);
    } else {
      if (record.date >= lastWeekStart) {
        lastWeekTotalHours += hours;
        lastWeekTotalHoursByGroup[groupKey] += hours;
        if (record.date <= lastWeekSameDay) {
          lastWeekToDateHours += hours;
          lastWeekToDateHoursByGroup[groupKey] += hours;
        }
      }
    }
  });

  roster.forEach((user, email) => {
    if (!peopleWithRecordsInLastTwoWeeks.has(email)) groups[groupFor(user)].twoWeekNoRecordCount++;
  });

  const topWorkers = Array.from(workerHours, ([email, hours]) => {
    const user = roster.get(email)!;
    return { email, name: user.name, classId: user.classId, hours };
  }).sort((a, b) => b.hours - a.hours || a.email.localeCompare(b.email)).slice(0, 3);

  return {
    weekStart,
    lastWeekStart,
    lastWeekSameDay,
    totalHours,
    lastWeekTotalHours,
    lastWeekTotalHoursByGroup,
    lastWeekToDateHours,
    lastWeekToDateHoursByGroup,
    sameDayChangePercent: changePercent(totalHours, lastWeekToDateHours),
    sameDayChangePercentByGroup: {
      junior: changePercent(groups.junior.totalHours, lastWeekToDateHoursByGroup.junior),
      senior: changePercent(groups.senior.totalHours, lastWeekToDateHoursByGroup.senior),
      other: changePercent(groups.other.totalHours, lastWeekToDateHoursByGroup.other),
    },
    pendingRecordCount,
    twoWeekNoRecordCount: groups.junior.twoWeekNoRecordCount + groups.senior.twoWeekNoRecordCount + groups.other.twoWeekNoRecordCount,
    groups: {
      junior: summarizeGroup(groups.junior),
      senior: summarizeGroup(groups.senior),
      other: summarizeGroup(groups.other),
    },
    topWorkers,
  };
}
