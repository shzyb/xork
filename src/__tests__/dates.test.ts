import { currentMonth, dayOfPeriod, daysInMonth, dueDateIn, keyRanges, monthGrid, occurrencesBetween, firstOnOrAfter, fullDate, lastMonths, monthName, monthShort, periodBounds, periodDayCount, periodOf, salaryPeriod, startDayPeriod, tomorrow, upcomingOccurrences, monthLabel, monthRange, nextOccurrence, prettyDate, shiftMonth, today, yesterday } from '../dates';

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

  it('handles quarterly, including month ends and the year wrap', () => {
    expect(nextOccurrence('quarterly', 10, '2026-10-10')).toBe('2027-01-10');
    expect(nextOccurrence('quarterly', 31, '2026-08-31')).toBe('2026-11-30');
    expect(nextOccurrence('quarterly', 31, '2026-11-30')).toBe('2027-02-28');
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
  it('writes the short weekday, day, short month and year', () => {
    expect(fullDate('2026-09-29')).toBe('Tue, 29 Sep 2026');
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

describe('pay periods, start-day mode', () => {
  it('is the calendar month when the month starts on the 1st, leap years included', () => {
    expect(startDayPeriod('2026-05-10', 1)).toEqual({ start: '2026-05-01', end: '2026-05-31', key: '2026-05' });
    expect(startDayPeriod('2028-02-29', 1)).toEqual({ start: '2028-02-01', end: '2028-02-29', key: '2028-02' });
  });

  it('names a period by the month it ends in', () => {
    expect(startDayPeriod('2026-05-10', 25)).toEqual({ start: '2026-04-25', end: '2026-05-24', key: '2026-05' });
    expect(startDayPeriod('2026-05-25', 25)).toEqual({ start: '2026-05-25', end: '2026-06-24', key: '2026-06' });
    expect(startDayPeriod('2026-06-24', 25).key).toBe('2026-06');
  });

  it('clamps a start day of 31 in short months', () => {
    expect(startDayPeriod('2026-02-27', 31)).toEqual({ start: '2026-01-31', end: '2026-02-27', key: '2026-02' });
    expect(startDayPeriod('2026-02-28', 31)).toEqual({ start: '2026-02-28', end: '2026-03-30', key: '2026-03' });
  });
});

describe('pay periods, salary mode', () => {
  const salaries = ['2026-03-25', '2026-05-25', '2026-06-27'];

  it('has no period before the first salary', () => {
    expect(salaryPeriod('2026-03-24', salaries)).toBeNull();
  });

  it('runs from one salary up to the day before the next', () => {
    expect(salaryPeriod('2026-04-10', salaries)).toEqual({ start: '2026-03-25', end: '2026-05-24', key: '2026-05' });
  });

  it('starts a new period on the salary day', () => {
    expect(salaryPeriod('2026-05-25', salaries)?.start).toBe('2026-05-25');
    expect(salaryPeriod('2026-06-26', salaries)).toEqual({ start: '2026-05-25', end: '2026-06-26', key: '2026-06' });
  });

  it('keeps the newest period open, named for where the next salary is expected', () => {
    expect(salaryPeriod('2026-06-27', salaries)).toEqual({ start: '2026-06-27', end: '9999-12-31', key: '2026-07' });
    expect(salaryPeriod('2026-09-01', salaries)?.start).toBe('2026-06-27');
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

describe('firstOnOrAfter', () => {
  it('keeps a date that is already today or later', () => {
    expect(firstOnOrAfter('monthly', 15, '2026-05-15', '2026-04-30')).toBe('2026-05-15');
    expect(firstOnOrAfter('weekly', 3, '2026-04-30', '2026-04-30')).toBe('2026-04-30');
  });

  it('skips forward past a paused period, keeping the anchor day at month ends', () => {
    expect(firstOnOrAfter('monthly', 31, '2026-01-31', '2026-04-30')).toBe('2026-04-30');
    expect(firstOnOrAfter('monthly', 31, '2026-01-31', '2026-05-01')).toBe('2026-05-31');
    expect(firstOnOrAfter('weekly', 3, '2026-01-01', '2026-01-20')).toBe('2026-01-22');
    expect(firstOnOrAfter('yearly', 29, '2024-02-29', '2026-03-01')).toBe('2027-02-28');
  });
});

describe('Recurring calendar helpers', () => {
  it('clamps a card due day to the length of the month', () => {
    expect(dueDateIn('2026-10', 31)).toBe('2026-10-31');
    expect(dueDateIn('2026-02', 31)).toBe('2026-02-28');
    expect(dueDateIn('2028-02', 30)).toBe('2028-02-29');
    expect(dueDateIn('2026-10', 5)).toBe('2026-10-05');
  });

  it('lays a month out Monday first with blanks before the 1st', () => {
    const grid = monthGrid('2026-10'); // 1 Oct 2026 is a Thursday
    expect(grid.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(grid).toHaveLength(3 + 31);
    expect(monthGrid('2026-06')[0]).toBe('2026-06-01'); // a Monday
  });

  it('projects a month-end item through a short month', () => {
    const item = { id: 1, freq: 'monthly' as const, anchor_day: 31, next_date: '2026-01-31', active: 1 };
    const found = occurrencesBetween([item], '2026-02-01', '2026-02-28');
    expect(found.map((f) => f.date)).toEqual(['2026-02-28']);
  });
});

describe('pay periods for totals', () => {
  it('a start day of 28 puts 30 Oct in the November period, 28 Oct to 27 Nov', () => {
    const cal = { startDay: 28, starts: null };
    expect(periodOf('2026-10-30', cal)).toEqual({ start: '2026-10-28', end: '2026-11-27', key: '2026-11' });
    expect(keyRanges('2026-11', cal)).toEqual([{ start: '2026-10-28', end: '2026-11-27' }]);
    expect(periodDayCount('2026-11', cal)).toBe(31);
    expect(dayOfPeriod('2026-10-30', cal)).toBe(3);
  });

  it('a salary on 30 Oct runs its period on to the next salary, named for the projected month', () => {
    const cal = { startDay: 1, starts: ['2026-10-30'] };
    expect(keyRanges('2026-11', cal)).toEqual([{ start: '2026-10-30', end: '9999-12-31' }]);
    expect(periodBounds('2026-11', cal)).toEqual({ start: '2026-10-30', end: '2026-11-29' });
  });

  it('before the first salary the calendar month is used, clipped at the salary', () => {
    const cal = { startDay: 1, starts: ['2026-10-20', '2026-11-20'] };
    expect(keyRanges('2026-10', cal)).toEqual([{ start: '2026-10-01', end: '2026-10-19' }]);
    expect(keyRanges('2026-11', cal)).toEqual([{ start: '2026-10-20', end: '2026-11-19' }]);
    expect(periodOf('2026-10-05', cal).key).toBe('2026-10');
  });

  it('two salaries in one month join into one range for that month', () => {
    const cal = { startDay: 1, starts: ['2026-10-10', '2026-10-20'] };
    expect(keyRanges('2026-10', cal)).toEqual([{ start: '2026-10-01', end: '2026-10-19' }]);
  });

  it('a month after the open period has no range yet, and its bounds fall back to the calendar month', () => {
    const cal = { startDay: 1, starts: ['2026-10-20'] };
    expect(keyRanges('2026-12', cal)).toEqual([]);
    expect(periodBounds('2026-12', cal)).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });
});
