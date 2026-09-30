import { formatMoney, formatTyped, guessCurrency, minorToTyped, parseAmount, setAppCurrency } from '../money';

describe('formatMoney', () => {
  it('shows no decimals for PKR', () => {
    setAppCurrency('PKR');
    expect(formatMoney(245000)).toBe('Rs 2,450');
    expect(formatMoney(0)).toBe('Rs 0');
    expect(formatMoney(12345600)).toBe('Rs 123,456');
    expect(formatMoney(-500000)).toBe('−Rs 5,000');
  });

  it('shows two decimals for USD', () => {
    setAppCurrency('USD');
    expect(formatMoney(245000)).toBe('$2,450.00');
    expect(formatMoney(1050)).toBe('$10.50');
    expect(formatMoney(5)).toBe('$0.05');
    expect(formatMoney(-1050)).toBe('−$10.50');
  });

  it('puts a space after letter-only symbols', () => {
    setAppCurrency('AED');
    expect(formatMoney(1000)).toBe('AED 10.00');
    setAppCurrency('CAD');
    expect(formatMoney(1000)).toBe('CA$10.00');
  });

  it('changing currency changes only the display, not the stored number', () => {
    setAppCurrency('PKR');
    const before = formatMoney(500000);
    setAppCurrency('USD');
    expect(before).toBe('Rs 5,000');
    expect(formatMoney(500000)).toBe('$5,000.00');
  });
});

describe('parseAmount', () => {
  it('converts typed text to minor units', () => {
    expect(parseAmount('2450')).toBe(245000);
    expect(parseAmount('12.5')).toBe(1250);
    expect(parseAmount('12.05')).toBe(1205);
    expect(parseAmount('0.5')).toBe(50);
    expect(parseAmount('7.')).toBe(700);
  });

  it('gives 0 for empty or invalid text', () => {
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('.')).toBe(0);
    expect(parseAmount('abc')).toBe(0);
  });
});

describe('guessCurrency', () => {
  it('uses the locale currency when we support it', () => {
    expect(guessCurrency({ currencyCode: 'GBP', regionCode: 'PK' })).toBe('GBP');
  });

  it('maps the region when the currency is not in our list', () => {
    expect(guessCurrency({ currencyCode: 'CHF', regionCode: 'PK' })).toBe('PKR');
    expect(guessCurrency({ currencyCode: null, regionCode: 'de' })).toBe('EUR');
  });

  it('falls back to USD', () => {
    expect(guessCurrency({ currencyCode: 'CHF', regionCode: 'CH' })).toBe('USD');
    expect(guessCurrency({})).toBe('USD');
  });
});

describe('formatTyped', () => {
  it('adds thousands separators to what was typed', () => {
    expect(formatTyped('')).toBe('0');
    expect(formatTyped('2450')).toBe('2,450');
    expect(formatTyped('1234567.5')).toBe('1,234,567.5');
    expect(formatTyped('12.')).toBe('12.');
  });
});

describe('minorToTyped', () => {
  it('is the inverse of parseAmount for editing', () => {
    expect(minorToTyped(245000)).toBe('2450');
    expect(minorToTyped(1250)).toBe('12.5');
    expect(minorToTyped(1205)).toBe('12.05');
    expect(minorToTyped(5)).toBe('0.05');
    for (const minor of [0, 5, 50, 1250, 1205, 245000]) {
      expect(parseAmount(minorToTyped(minor))).toBe(minor);
    }
  });
});
