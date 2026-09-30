import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sheet } from '../theme';

// A floating black tray over a dimmed screen. It is only as tall as its content (scroll inside it if it is long).
// The screen itself must be a transparent modal that fades, so the dim layer fades in place and only the tray slides up.
export function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const slide = useRef(new Animated.Value(320)).current;

  useEffect(() => {
    Animated.timing(slide, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [slide]);

  return (
    <View style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={StyleSheet.absoluteFill} />
      <Animated.View
        style={[
          styles.tray,
          { maxHeight: height - insets.top - 24, marginBottom: 8 + insets.bottom, transform: [{ translateY: slide }] },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  tray: { backgroundColor: sheet.bg, borderRadius: 34, marginHorizontal: 8, paddingHorizontal: 20, paddingBottom: 8 },
});
