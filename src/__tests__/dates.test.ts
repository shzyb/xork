import { currentMonth, daysInMonth, fullDate, lastMonths, monthName, monthShort, tomorrow, upcomingOccurrences, monthLabel, monthRange, nextOccurrence, prettyDate, shiftMonth, today, yesterday } from '../dates';

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

  it('walks a 31st anchor through short months and back', () => {
    const dates = ['2026-01-31'];
    for (let i = 0; i < 4; i++) dates.push(nextOccurrence('monthly', 31, dates[i]));
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });

  it('follows the leap day for a 29th anchor', () => {
    expect(nextOccurrence('monthly', 29, '2028-01-29')).toBe('2028-02-29');
    expect(nextOccurrence('monthly', 29, '2027-01-29')).toBe('2027-02-28');
    expect(nextOccurrence('monthly', 29, '2027-02-28')).toBe('2027-03-29');
  });

  it('crosses the year end', () => {
    expect(nextOccurrence('monthly', 15, '2026-12-15')).toBe('2027-01-15');
    expect(nextOccurrence('yearly', 31, '2026-12-31')).toBe('2027-12-31');
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

describe('fullDate', () => {
  it('writes the weekday, day, month and year', () => {
    expect(fullDate('2026-09-29')).toBe('Tuesday, 29 September 2026');
  });
});

describe('tomorrow', () => {
  it('is named in prettyDate', () => {
    expect(prettyDate(tomorrow())).toBe('Tomorrow');
  });
});

describe('upcomingOccurrences', () => {
  const item = (id: number, freq: 'weekly' | 'monthly' | 'yearly', next_date: string, active = 1) => ({
    id, freq, anchor_day: Number(next_date.slice(8)), next_date, active,
  });

  it('lists every occurrence inside the window, soonest first', () => {
    const found = upcomingOccurrences(
      [item(1, 'weekly', '2026-10-03'), item(2, 'monthly', '2026-10-01')],
      '2026-09-30',
      14,
    );
    expect(found.map((f) => [f.item.id, f.date])).toEqual([
      [2, '2026-10-01'],
      [1, '2026-10-03'],
      [1, '2026-10-10'],
    ]);
  });

  it('includes today and the last day of the window', () => {
    const found = upcomingOccurrences([item(1, 'weekly', '2026-09-30')], '2026-09-30', 7);
    expect(found.map((f) => f.date)).toEqual(['2026-09-30', '2026-10-07']);
  });

  it('skips paused items and items further away than the window', () => {
    const found = upcomingOccurrences(
      [item(1, 'monthly', '2026-10-01', 0), item(2, 'yearly', '2027-03-01')],
      '2026-09-30',
      30,
    );
    expect(found).toEqual([]);
  });
});

describe('month helpers for Insights', () => {
  it('lists the last months, oldest first, across a year end', () => {
    expect(lastMonths('2026-02', 6)).toEqual(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('names a month', () => {
    expect(monthShort('2026-09')).toBe('Sep');
    expect(monthName('2026-09')).toBe('September');
  });

  it('knows how long a month is, including leap February', () => {
    expect(daysInMonth('2026-09')).toBe(30);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2027-02')).toBe(28);
  });
});
