import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { ArrowDown, ArrowLeftRight, ArrowUp } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { actionColors, sheet } from '../theme';
import type { TransactionType } from '../types';

// `width` is the open size: icon, gap and label, so the label fits without measuring.
const OPTIONS: { type: TransactionType; label: string; Icon: LucideIcon; width: number }[] = [
  { type: 'expense', label: 'Expense', Icon: ArrowUp, width: 110 },
  { type: 'income', label: 'Income', Icon: ArrowDown, width: 104 },
  { type: 'transfer', label: 'Move', Icon: ArrowLeftRight, width: 90 },
];
const CLOSED_WIDTH = 44;
const MS = 200;

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then((on) => {
  reduceMotion = on;
});
AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
  reduceMotion = on;
});

// A pill with Expense, Income and Move. The chosen one opens to show its label; the others are icons only.
export function TypeSwitch({ value, onChange }: { value: TransactionType; onChange: (type: TransactionType) => void }) {
  return (
    <View accessibilityRole="tablist" style={styles.pill}>
      {OPTIONS.map((o) => (
        <Segment key={o.type} option={o} active={o.type === value} onPress={() => onChange(o.type)} />
      ))}
    </View>
  );
}

function Segment({ option, active, onPress }: { option: (typeof OPTIONS)[number]; active: boolean; onPress: () => void }) {
  const { type, label, Icon, width } = option;
  const color = actionColors[type];
  const open = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      open.setValue(active ? 1 : 0);
      return;
    }
    Animated.timing(open, { toValue: active ? 1 : 0, duration: MS, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: false }).start();
  }, [active, open]);

  return (
    <Animated.View
      style={[
        styles.segment,
        {
          width: open.interpolate({ inputRange: [0, 1], outputRange: [CLOSED_WIDTH, width] }),
          backgroundColor: open.interpolate({ inputRange: [0, 1], outputRange: [`${color}00`, `${color}38`] }),
        },
      ]}
    >
      <PressableScale
        accessibilityRole="tab"
        accessibilityLabel={label === 'Move' ? 'Move money' : label}
        accessibilityState={{ selected: active }}
        onPress={onPress}
        style={styles.press}
      >
        <Icon color={color} size={18} strokeWidth={2.4} />
        <Animated.View style={{ opacity: open }}>
          <Text numberOfLines={1} style={[styles.label, { color }]}>{label}</Text>
        </Animated.View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', height: 52, padding: 4, borderRadius: 26, backgroundColor: sheet.card },
  segment: { height: 44, borderRadius: 22, overflow: 'hidden' },
  press: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 13 },
  label: { fontSize: 15, fontWeight: '700' },
});
