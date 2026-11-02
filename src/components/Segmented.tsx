import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useColorScheme, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { spacing, useColors } from '../theme';
import { Text } from './Text';

const GAP = 3;
const PAD = 3;

// A row of options where the chosen one sits on a pill that slides across when you switch. Used for Recurring's tabs and
// Insights' Month / Year.
export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  // In dark mode the chosen option sits on the lighter grey, as the Add transaction tabs do.
  const dark = useColorScheme() === 'dark';
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const cell = width > 0 ? (width - PAD * 2 - GAP * (options.length - 1)) / options.length : 0;
  const slide = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    Animated.timing(slide, { toValue: index, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [index, slide]);

  return (
    <View style={[styles.track, { backgroundColor: colors.fill }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {cell > 0 && (
        <Animated.View
          style={[styles.pill, {
            width: cell,
            backgroundColor: dark ? colors.fill2 : colors.bg,
            transform: [{ translateX: slide.interpolate({ inputRange: [0, options.length - 1], outputRange: [0, (options.length - 1) * (cell + GAP)] }) }],
          }]}
        />
      )}
      {options.map((o) => (
        <PressableScale
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => onChange(o.value)}
          style={[styles.option, { width: cell }]}
        >
          <Text style={{ fontSize: 14.5, fontWeight: '600', color: o.value === value ? colors.ink : colors.ink2 }}>{o.label}</Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 22, padding: PAD, gap: GAP, marginTop: spacing.md },
  pill: { position: 'absolute', top: PAD, left: PAD, height: 38, borderRadius: 19 },
  option: { height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
