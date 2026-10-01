import { useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const PRESS_MS = 120;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then((on) => {
  reduceMotion = on;
});
AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
  reduceMotion = on;
});

// A Pressable that dips to 97% while pressed. With "reduce motion" on, it dims to 70% instead of moving.
export function PressableScale({ style, onPressIn, onPressOut, ...rest }: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }) {
  const scale = useRef(new Animated.Value(1)).current;
  const dim = useRef(new Animated.Value(1)).current;

  function animate(pressed: boolean) {
    const to = (value: Animated.Value, toValue: number) =>
      Animated.timing(value, { toValue, duration: PRESS_MS, easing: EASE_OUT, useNativeDriver: true });
    Animated.parallel([
      to(scale, pressed && !reduceMotion ? 0.97 : 1),
      to(dim, pressed && reduceMotion ? 0.7 : 1),
    ]).start();
  }

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        animate(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animate(false);
        onPressOut?.(e);
      }}
      style={[style, { opacity: dim, transform: [{ scale }] }]}
    />
  );
}
