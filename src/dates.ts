import { addDays, addMonths, differenceInCalendarDays, format, getDaysInMonth, parseISO, subDays } from 'date-fns';
import type { Frequency } from './types';

const DAY = 'yyyy-MM-dd';
const MONTH = 'yyyy-MM';

export function today(): string {
  return format(new Date(), DAY);
}

export function currentMonth(): string {
  return format(new Date(), MONTH);
}

export function shiftMonth(month: string, by: number): string {
  return format(addMonths(parseISO(month + '-01'), by), MONTH);
}

export function monthLabel(month: string): string {
  return format(parseISO(month + '-01'), 'MMMM yyyy');
}

export function monthRange(month: string): { start: string; end: string } {
  const first = parseISO(month + '-01');
  return { start: month + '-01', end: format(first, MONTH) + '-' + getDaysInMonth(first) };
}

// The date after `from` for a recurring item. Monthly and yearly keep the original
// day-of-month (`anchorDay`), clamped to the month's length: 31st -> 28th -> back to 31st.
export function nextOccurrence(freq: Frequency, anchorDay: number, from: string): string {
  const date = parseISO(from);
  if (freq === 'weekly') return format(addDays(date, 7), DAY);
  const months = { monthly: 1, quarterly: 3, yearly: 12 }[freq];
  const target = addMonths(new Date(date.getFullYear(), date.getMonth(), 1), months);
  const day = Math.min(anchorDay, getDaysInMonth(target));
  return format(new Date(target.getFullYear(), target.getMonth(), day), DAY);
}

export function yesterday(): string {
  return format(subDays(new Date(), 1), DAY);
}

export function prettyDate(date: string): string {
  if (date === today()) return 'Today';
  if (date === yesterday()) return 'Yesterday';
  if (date === tomorrow()) return 'Tomorrow';
  const d = parseISO(date);
  return format(d, d.getFullYear() === new Date().getFullYear() ? 'EEE, d MMM' : 'EEE, d MMM yyyy');
}

export function toDay(date: Date): string {
  return format(date, DAY);
}

export function fromDay(day: string): Date {
  return parseISO(day);
}

export function fullDate(day: string): string {
  return format(parseISO(day), 'EEE, d MMM yyyy');
}

export function tomorrow(): string {
  return format(addDays(new Date(), 1), DAY);
}

// Every occurrence of the active items from `from` up to `days` days later, soonest first.
export function upcomingOccurrences<T extends { freq: Frequency; anchor_day: number; next_date: string; active: number }>(
  items: T[],
  from: string,
  days: number,
): { item: T; date: string }[] {
  return occurrencesBetween(items, from, format(addDays(parseISO(from), days), DAY));
}

// Every occurrence of the active items from `from` to `end`, both included, soonest first.
export function occurrencesBetween<T extends { freq: Frequency; anchor_day: number; next_date: string; active: number }>(
  items: T[],
  from: string,
  end: string,
): { item: T; date: string }[] {
  const found: { item: T; date: string }[] = [];
  for (const item of items) {
    if (!item.active) continue;
    let date = item.next_date;
    while (date <= end) {
      if (date >= from) found.push({ item, date });
      date = nextOccurrence(item.freq, item.anchor_day, date);
    }
  }
  return found.sort((a, b) => a.date.localeCompare(b.date));
}

export const FREQUENCY_LABEL: Record<Frequency, string> = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };

// The last `count` month keys ending at `month`, oldest first.
export function lastMonths(month: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(month, i - count + 1));
}

export function monthShort(month: string): string {
  return format(parseISO(month + '-01'), 'MMM');
}

export function monthName(month: string): string {
  return format(parseISO(month + '-01'), 'MMMM');
}

// 1 -> "1st", 22 -> "22nd", 31 -> "31st".
export function ordinalDay(n: number): string {
  const suffix = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

// The date a card payment is due in `month`; a due day of 31 becomes the 28th in February.
export function dueDateIn(month: string, dueDay: number): string {
  return month + '-' + String(Math.min(dueDay, getDaysInMonth(parseISO(month + '-01')))).padStart(2, '0');
}

// The days of `month` for a calendar that starts on Monday, with null for the empty cells before the 1st.
export function monthGrid(month: string): (string | null)[] {
  const blanks = (parseISO(month + '-01').getDay() + 6) % 7;
  const days = getDaysInMonth(parseISO(month + '-01'));
  return [
    ...Array<null>(blanks).fill(null),
    ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
}

export function daysInMonth(month: string): number {
  return getDaysInMonth(parseISO(month + '-01'));
}

// The first occurrence of a recurring item on or after `from`, counting on from `date`.
// Used when resuming a paused item, so the days it was paused are skipped rather than logged.
export function firstOnOrAfter(freq: Frequency, anchorDay: number, date: string, from: string): string {
  let next = date;
  while (next < from) next = nextOccurrence(freq, anchorDay, next);
  return next;
}

// A pay period is the days from `start` to `end`, both included. It is named by the month it ends in.
export type PayPeriod = { start: string; end: string; key: string };

// The period from `start` up to the day before `nextStart`.
function periodBetween(start: string, nextStart: string): PayPeriod {
  const end = format(subDays(parseISO(nextStart), 1), DAY);
  return { start, end, key: end.slice(0, 7) };
}

// The period `date` falls in when the month starts on `startDay` (1 is the calendar month).
// Paid on the 25th: 25 May - 24 Jun is named June.
export function startDayPeriod(date: string, startDay: number): PayPeriod {
  const month = date.slice(0, 7);
  let start = dueDateIn(month, startDay);
  if (date < start) start = dueDateIn(shiftMonth(month, -1), startDay);
  return periodBetween(start, dueDateIn(shiftMonth(start.slice(0, 7), 1), startDay));
}

const OPEN_END = '9999-12-31';

// The period `date` falls in when each salary starts a new one. `salaryDates` is sorted oldest first.
// Null before the first salary. The newest period stays open until the next salary is recorded, so
// nothing dated after a late salary is lost; its name assumes the next salary lands on the same day of the month.
export function salaryPeriod(date: string, salaryDates: string[]): PayPeriod | null {
  let i = -1;
  while (i + 1 < salaryDates.length && salaryDates[i + 1] <= date) i++;
  if (i < 0) return null;
  const start = salaryDates[i];
  if (i + 1 < salaryDates.length) return periodBetween(start, salaryDates[i + 1]);
  const projected = dueDateIn(shiftMonth(start.slice(0, 7), 1), Number(start.slice(8)));
  return { start, end: OPEN_END, key: periodBetween(start, projected).key };
}

// How periods are cut. `starts` are the salary-mode period starts, oldest first; null means start-day mode.
export type PayCalendar = { startDay: number; starts: string[] | null };

export type DayRange = { start: string; end: string };

export function shiftDays(date: string, days: number): string {
  return format(addDays(parseISO(date), days), DAY);
}

// The period a date falls in. Before the first salary, salary mode uses calendar months.
export function periodOf(date: string, cal: PayCalendar): PayPeriod {
  if (cal.starts) return salaryPeriod(date, cal.starts) ?? startDayPeriod(date, 1);
  return startDayPeriod(date, cal.startDay);
}

// Where the next salary is expected: the same day of the next month as this one.
function projectedEnd(start: string): string {
  return shiftDays(dueDateIn(shiftMonth(start.slice(0, 7), 1), Number(start.slice(8))), -1);
}

function mergeRanges(ranges: DayRange[]): DayRange[] {
  const merged: DayRange[] = [];
  for (const r of [...ranges].sort((a, b) => a.start.localeCompare(b.start))) {
    const prev = merged[merged.length - 1];
    if (prev && (prev.end === OPEN_END || r.start <= shiftDays(prev.end, 1))) {
      if (r.end > prev.end) prev.end = r.end;
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

// The days that belong to period `key` (named by the month it ends in), as ranges. Usually one.
// In salary mode the calendar month before the first salary is clipped at that salary.
// The open period runs to OPEN_END, so queries also catch a late salary's spending.
export function keyRanges(key: string, cal: PayCalendar): DayRange[] {
  const { start: first, end: last } = monthRange(key);
  const starts = cal.starts;
  if (!starts) {
    const p = startDayPeriod(first, cal.startDay);
    return [{ start: p.start, end: p.end }];
  }
  const ranges: DayRange[] = [];
  if (first < starts[0]) ranges.push({ start: first, end: last < starts[0] ? last : shiftDays(starts[0], -1) });
  starts.forEach((start, i) => {
    const end = i + 1 < starts.length ? shiftDays(starts[i + 1], -1) : OPEN_END;
    const periodKey = (end === OPEN_END ? projectedEnd(start) : end).slice(0, 7);
    if (periodKey === key) ranges.push({ start, end });
  });
  return mergeRanges(ranges);
}

// The first and last day of period `key`. The open period ends on its projected date.
export function periodBounds(key: string, cal: PayCalendar): DayRange {
  const ranges = keyRanges(key, cal);
  if (ranges.length === 0) return monthRange(key);
  const last = ranges[ranges.length - 1];
  return { start: ranges[0].start, end: last.end === OPEN_END ? projectedEnd(last.start) : last.end };
}

export function periodDayCount(key: string, cal: PayCalendar): number {
  const { start, end } = periodBounds(key, cal);
  return differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
}

// Which day of its period a date is: 1 on the first day.
export function dayOfPeriod(date: string, cal: PayCalendar): number {
  return differenceInCalendarDays(parseISO(date), parseISO(periodOf(date, cal).start)) + 1;
}
