import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sheet, useTrayColor } from '../theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const ENTER_MS = 260;
const EXIT_MS = 200;

// A floating black tray over a dimmed screen. It is only as tall as its content (scroll inside it if it is long).
// The tray slides up and the dim fades in; going back (close button, backdrop, Android back) plays that in reverse.
// A route that uses it is a transparent modal with no router animation, so this component owns all the motion.
// `color` replaces the usual tray colour, for a tray that opens over the black add page.
export function Sheet({ onClose, color, children }: { onClose: () => void; color?: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const navigation = useNavigation();
  const trayColor = useTrayColor();
  const slide = useRef(new Animated.Value(height)).current;
  const dim = useRef(new Animated.Value(0)).current;
  const hiddenAt = useRef(height);
  const entered = useRef(false);
  const closing = useRef(false);
  const running = useRef<Animated.CompositeAnimation | null>(null);

  // `done` only runs if the animation played to the end, not if the tray was removed (or reopened) part-way.
  function run(slideTo: number, dimTo: number, duration: number, done?: () => void) {
    const animation = Animated.parallel([
      Animated.timing(slide, { toValue: slideTo, duration, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(dim, { toValue: dimTo, duration, easing: EASE_OUT, useNativeDriver: true }),
    ]);
    running.current = animation;
    animation.start(({ finished }) => {
      if (finished) done?.();
    });
  }

  useEffect(() => () => running.current?.stop(), []);

  // Hold back a "go back" until the exit has played, then let it through. Replace and push are left alone.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        const type = e.data.action.type;
        if (closing.current || (type !== 'GO_BACK' && type !== 'POP')) return;
        e.preventDefault();
        closing.current = true;
        run(hiddenAt.current, 0, EXIT_MS, () => {
          if (navigation.canGoBack()) navigation.dispatch(e.data.action);
        });
      }),
    [navigation],
  );

  return (
    <View style={styles.root}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: sheet.scrim, opacity: dim }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={StyleSheet.absoluteFill} />
      <Animated.View
        onLayout={(e) => {
          hiddenAt.current = e.nativeEvent.layout.height + 8 + insets.bottom;
          if (entered.current) return;
          entered.current = true;
          slide.setValue(hiddenAt.current);
          run(0, 1, ENTER_MS);
        }}
        style={[
          styles.tray,
          { backgroundColor: color ?? trayColor },
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
