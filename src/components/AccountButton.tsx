import { StyleSheet, View } from 'react-native';
import { PickerSheet } from './PickerSheet';
import type { PickerOption } from './PickerSheet';
import { PressableScale } from './PressableScale';
import { formatMoney } from '../money';
import { sheet } from '../theme';
import { Text } from './Text';

type Account = { name: string; color: string; balance_minor: number };

export const BUTTON_HEIGHT = 44; // the date and note buttons use the same height

// The account's coloured initial, used in the button and in the picker rows.
export function AccountDot({ account, size }: { account: Account; size: number }) {
  return (
    <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: account.color }]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{account.name.trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
}

// "Choose one account" sheet, one row per account with its balance.
export function AccountPicker({ title, accounts, current, onPick, onClose }: {
  title: string;
  accounts: ({ id: number } & Account)[];
  current: number;
  onPick: (id: number) => void;
  onClose: () => void;
}) {
  const options: PickerOption<number>[] = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    sub: formatMoney(a.balance_minor),
    lead: <AccountDot account={a} size={40} />,
  }));
  return <PickerSheet title={title} options={options} current={current} onPick={onPick} onClose={onClose} color={sheet.card2} />;
}

// A pill showing an account's name. Tapping it opens the account picker.
export function AccountButton({ account, label, onPress }: { account: Account; label: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`${label}: ${account.name}. Tap to change`} onPress={onPress} style={styles.button}>
      <AccountDot account={account} size={32} />
      <Text style={styles.name} numberOfLines={1}>{account.name}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: BUTTON_HEIGHT, paddingLeft: 6, paddingRight: 16, borderRadius: BUTTON_HEIGHT / 2, backgroundColor: sheet.card },
  name: { flexShrink: 1, color: sheet.ink, fontSize: 15, fontWeight: '600' },
  dot: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#FFFFFF', fontWeight: '700' },
});
