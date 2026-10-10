import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { ArrowDown, ArrowLeftRight, ArrowUp } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { sheet } from '../theme';
import type { TransactionType } from '../types';

const OPTIONS: { type: TransactionType; label: string; Icon: LucideIcon }[] = [
  { type: 'expense', label: 'Expense', Icon: ArrowUp },
  { type: 'income', label: 'Income', Icon: ArrowDown },
  { type: 'transfer', label: 'Move', Icon: ArrowLeftRight },
];
const SIZE = 40; // a closed segment is a square with the icon centred
const ICON = 18;
const INSET = (SIZE - ICON) / 2; // space left of the icon, so it sits centred when closed
const GAP = 7;
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
  const { label, Icon } = option;
  const open = useRef(new Animated.Value(active ? 1 : 0)).current;
  const [labelWidth, setLabelWidth] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      open.setValue(active ? 1 : 0);
      return;
    }
    Animated.timing(open, { toValue: active ? 1 : 0, duration: MS, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: false }).start();
  }, [active, open]);

  const openWidth = INSET + ICON + GAP + labelWidth + INSET + 2;

  return (
    <Animated.View
      style={[
        styles.segment,
        {
          width: open.interpolate({ inputRange: [0, 1], outputRange: [SIZE, openWidth] }),
          backgroundColor: open.interpolate({ inputRange: [0, 1], outputRange: [`${sheet.card2}00`, sheet.card2] }),
        },
      ]}
    >
      <PressableScale
        accessibilityRole="tab"
        accessibilityLabel={label === 'Move' ? 'Move money' : label}
        accessibilityState={{ selected: active }}
        hitSlop={2}
        onPress={onPress}
        style={styles.press}
      >
        <View style={styles.icon}>
          <Icon color={active ? sheet.ink : sheet.ink2} size={ICON} strokeWidth={2.4} />
        </View>
        <Animated.View style={[styles.labelBox, { opacity: open }]}>
          <Text numberOfLines={1} onLayout={(e) => setLabelWidth(Math.ceil(e.nativeEvent.layout.width))} style={styles.label}>
            {label}
          </Text>
        </Animated.View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', height: 44, padding: 2, borderRadius: 22, backgroundColor: sheet.card },
  segment: { height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden' },
  press: { width: '100%', height: SIZE },
  icon: { position: 'absolute', left: INSET, top: INSET, width: ICON, height: ICON },
  // Wide on purpose: the label measures its own natural width, and the segment's overflow hides the part that is not open yet.
  labelBox: { position: 'absolute', left: INSET + ICON + GAP, top: 0, bottom: 0, width: 200, justifyContent: 'center' },
  label: { alignSelf: 'flex-start', color: sheet.ink, fontSize: 15, fontWeight: '700' },
});
