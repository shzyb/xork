import type { Frequency } from './types';

export type Currency = { code: string; symbol: string; decimals: number; name: string };

export const CURRENCIES: Currency[] = [
  { code: 'PKR', symbol: 'Rs', decimals: 0, name: 'Pakistani rupee' },
  { code: 'INR', symbol: '₹', decimals: 0, name: 'Indian rupee' },
  { code: 'USD', symbol: '$', decimals: 2, name: 'US dollar' },
  { code: 'GBP', symbol: '£', decimals: 2, name: 'British pound' },
  { code: 'EUR', symbol: '€', decimals: 2, name: 'Euro' },
  { code: 'AED', symbol: 'AED', decimals: 2, name: 'UAE dirham' },
  { code: 'SAR', symbol: 'SAR', decimals: 2, name: 'Saudi riyal' },
  { code: 'BDT', symbol: '৳', decimals: 0, name: 'Bangladeshi taka' },
  { code: 'CAD', symbol: 'CA$', decimals: 2, name: 'Canadian dollar' },
  { code: 'AUD', symbol: 'A$', decimals: 2, name: 'Australian dollar' },
  { code: 'MYR', symbol: 'RM', decimals: 2, name: 'Malaysian ringgit' },
  { code: 'TRY', symbol: '₺', decimals: 2, name: 'Turkish lira' },
  { code: 'EGP', symbol: 'E£', decimals: 2, name: 'Egyptian pound' },
  { code: 'NGN', symbol: '₦', decimals: 0, name: 'Nigerian naira' },
  { code: 'JPY', symbol: '¥', decimals: 0, name: 'Japanese yen' },
];

const REGION_CURRENCY: Record<string, string> = {
  PK: 'PKR', IN: 'INR', US: 'USD', GB: 'GBP', AE: 'AED', SA: 'SAR', BD: 'BDT',
  CA: 'CAD', AU: 'AUD', MY: 'MYR', TR: 'TRY', EG: 'EGP', NG: 'NGN', JP: 'JPY',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR',
  AT: 'EUR', BE: 'EUR', FI: 'EUR', GR: 'EUR',
};

let appCurrency = 'USD';

export function setAppCurrency(code: string) {
  appCurrency = code;
}

export function currencyOf(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[2];
}

export function guessCurrency(locale: { currencyCode?: string | null; regionCode?: string | null }): string {
  if (locale.currencyCode && CURRENCIES.some((c) => c.code === locale.currencyCode)) {
    return locale.currencyCode;
  }
  return (locale.regionCode && REGION_CURRENCY[locale.regionCode.toUpperCase()]) || 'USD';
}

// minor = amount × 100, whatever the currency. Only the display changes.
export function formatMoney(minor: number): string {
  const { symbol, decimals } = currencyOf(appCurrency);
  const abs = Math.abs(minor);
  const whole = decimals === 0 ? Math.round(abs / 100) : Math.floor(abs / 100);
  let text = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decimals > 0) text += '.' + String(abs % 100).padStart(2, '0');
  const space = /^[A-Za-z]+$/.test(symbol) ? ' ' : '';
  const sign = minor < 0 && (whole > 0 || abs % 100 > 0) ? '−' : '';
  return sign + symbol + space + text;
}

// Turns what the keypad typed ("2450", "12.5") into minor units. Empty or invalid gives 0.
export function parseAmount(text: string): number {
  if (!/^\d*\.?\d*$/.test(text) || text === '' || text === '.') return 0;
  const [whole, frac = ''] = text.split('.');
  return Number(whole || '0') * 100 + Number(frac.slice(0, 2).padEnd(2, '0'));
}

export function currentDecimals(): number {
  return currencyOf(appCurrency).decimals;
}

export function currentSymbol(): string {
  return currencyOf(appCurrency).symbol;
}

// The amount as typed on the keypad, with thousands separators: "2450.5" -> "2,450.5".
export function formatTyped(text: string): string {
  const [whole, frac] = text.split('.');
  const grouped = (whole || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac === undefined ? grouped : grouped + '.' + frac;
}

// Inverse of parseAmount, for editing: 245000 -> "2450", 1250 -> "12.5".
export function minorToTyped(minor: number): string {
  const frac = minor % 100;
  const whole = String(Math.floor(minor / 100));
  return frac === 0 ? whole : whole + '.' + String(frac).padStart(2, '0').replace(/0$/, '');
}

// What a recurring amount comes to in an average month.
export function monthlyMinor(minor: number, freq: Frequency): number {
  if (freq === 'weekly') return Math.round((minor * 52) / 12);
  if (freq === 'yearly') return Math.round(minor / 12);
  return minor;
}
