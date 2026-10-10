import { ArrowRight } from 'lucide-react-native';
import { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
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

const DOT = 28; // the initials shown when the route shrinks
const ARROW = 30;
// How wide the route pill is once it has shrunk to two initials and the arrow. The note field grows up to this.
export const ROUTE_COMPACT_WIDTH = 8 + DOT + 6 + 14 + 6 + DOT + 8;

// "Cash → Savings" for Move money: one pill, each name opens its own picker, the arrow swaps them.
// `t` is the note row's morph (0 to 1). As it runs the names fade out and the pill shrinks to two initials,
// to leave room for the note field. The full-size content stays in the layout (just faded) so nothing else shifts.
export function RouteButton({ from, to, t, onPickFrom, onPickTo, onSwap }: {
  from: Account;
  to: Account;
  t: Animated.Value;
  onPickFrom: () => void;
  onPickTo: () => void;
  onSwap: () => void;
}) {
  const [fullWidth, setFullWidth] = useState(0);
  const fullOpacity = t.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp' });
  const compactOpacity = t.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const half = (account: Account, label: string, onPress: () => void) => (
    <PressableScale accessibilityRole="button" accessibilityLabel={`${label}: ${account.name}. Tap to change`} onPress={onPress} style={styles.half}>
      <View style={[styles.smallDot, { backgroundColor: account.color }]} />
      <Text style={styles.name} numberOfLines={1}>{account.name}</Text>
    </PressableScale>
  );

  return (
    <View style={styles.route} onLayout={(e) => setFullWidth(e.nativeEvent.layout.width)}>
      <Animated.View
        style={[styles.routeBackground, { width: fullWidth > 0 ? t.interpolate({ inputRange: [0, 1], outputRange: [fullWidth, ROUTE_COMPACT_WIDTH] }) : '100%' }]}
      />
      <Animated.View pointerEvents="box-none" style={[styles.routeFull, { opacity: fullOpacity }]}>
        {half(from, 'From', onPickFrom)}
        <PressableScale accessibilityRole="button" accessibilityLabel="Swap accounts" hitSlop={7} onPress={onSwap} style={styles.arrow}>
          <ArrowRight color={sheet.ink2} size={16} />
        </PressableScale>
        {half(to, 'To', onPickTo)}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.routeCompact, { opacity: compactOpacity }]}>
        <AccountDot account={from} size={DOT} />
        <ArrowRight color={sheet.ink2} size={14} />
        <AccountDot account={to} size={DOT} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  route: { flexShrink: 1, height: BUTTON_HEIGHT },
  routeBackground: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: BUTTON_HEIGHT / 2, backgroundColor: sheet.card },
  routeFull: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  routeCompact: { position: 'absolute', left: 0, top: 0, bottom: 0, width: ROUTE_COMPACT_WIDTH, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  half: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: BUTTON_HEIGHT },
  smallDot: { width: 8, height: 8, borderRadius: 4 },
  arrow: { width: ARROW, height: BUTTON_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  button: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: BUTTON_HEIGHT, paddingLeft: 6, paddingRight: 16, borderRadius: BUTTON_HEIGHT / 2, backgroundColor: sheet.card },
  name: { flexShrink: 1, color: sheet.ink, fontSize: 15, fontWeight: '600' },
  dot: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#FFFFFF', fontWeight: '700' },
});
