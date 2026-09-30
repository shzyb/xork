import { addDays, addMonths, format, getDaysInMonth, parseISO } from 'date-fns';
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
