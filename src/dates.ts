import { addDays, addMonths, format, getDaysInMonth, parseISO, subDays } from 'date-fns';
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
  const target = addMonths(new Date(date.getFullYear(), date.getMonth(), 1), freq === 'yearly' ? 12 : 1);
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
  return format(parseISO(day), 'EEEE, d MMMM yyyy');
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
  const end = format(addDays(parseISO(from), days), DAY);
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

export const FREQUENCY_LABEL: Record<Frequency, string> = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
