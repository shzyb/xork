import { currentMonth, monthLabel, monthRange, nextOccurrence, prettyDate, shiftMonth, today, yesterday } from '../dates';

describe('today', () => {
  it('is a local YYYY-MM-DD string', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(today().slice(0, 7)).toBe(currentMonth());
  });
});

describe('month helpers', () => {
  it('shifts across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-11', 3)).toBe('2027-02');
  });

  it('labels a month', () => {
    expect(monthLabel('2026-09')).toBe('September 2026');
  });

  it('gives the first and last day, including leap February', () => {
    expect(monthRange('2026-09')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(monthRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(monthRange('2027-02').end).toBe('2027-02-28');
  });
});

describe('nextOccurrence', () => {
  it('adds seven days for weekly', () => {
    expect(nextOccurrence('weekly', 3, '2026-12-28')).toBe('2027-01-04');
  });

  it('keeps the anchor day for monthly, clamped at month end', () => {
    expect(nextOccurrence('monthly', 15, '2026-01-15')).toBe('2026-02-15');
    expect(nextOccurrence('monthly', 31, '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrence('monthly', 31, '2026-02-28')).toBe('2026-03-31');
    expect(nextOccurrence('monthly', 31, '2026-12-31')).toBe('2027-01-31');
  });

  it('handles yearly, including 29 February', () => {
    expect(nextOccurrence('yearly', 10, '2026-05-10')).toBe('2027-05-10');
    expect(nextOccurrence('yearly', 29, '2028-02-29')).toBe('2029-02-28');
    expect(nextOccurrence('yearly', 29, '2027-02-28')).toBe('2028-02-29');
  });
});

describe('prettyDate', () => {
  it('names today and yesterday', () => {
    expect(prettyDate(today())).toBe('Today');
    expect(prettyDate(yesterday())).toBe('Yesterday');
  });

  it('shows weekday, day and month, adding the year for other years', () => {
    expect(prettyDate('2020-03-04')).toBe('Wed, 4 Mar 2020');
  });
});
