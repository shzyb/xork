import { NumberFlow } from 'number-flow-react-native';
import { StyleSheet } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { currentDecimals, currentSymbol } from '../money';
import { familyFor } from './Text';

// An amount whose digits roll when it changes. Reads like formatMoney: "Rs 5,000", "$12.50", "−€3.00".
// `plus` puts "+ " in front, for income.
export function AmountText({ minor, style, plus }: { minor: number; style: StyleProp<TextStyle>; plus?: boolean }) {
  const flat = StyleSheet.flatten(style) ?? {};
  const decimals = currentDecimals();
  const symbol = currentSymbol();
  const abs = Math.abs(minor);
  const value = decimals === 0 ? Math.round(abs / 100) : abs / 100;
  const prefix = (plus ? '+ ' : '') + (minor < 0 && value > 0 ? '−' : '') + symbol + (/^[A-Za-z]+$/.test(symbol) ? ' ' : '');
  return (
    <NumberFlow
      value={value}
      prefix={prefix}
      locales="en-US"
      format={{ minimumFractionDigits: decimals, maximumFractionDigits: decimals }}
      style={{ ...flat, fontFamily: familyFor(flat.fontWeight), fontWeight: 'normal' }}
    />
  );
}
