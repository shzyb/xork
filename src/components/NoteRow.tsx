import { StickyNote } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, Easing, Keyboard, StyleSheet, View } from 'react-native';
import { BUTTON_HEIGHT } from './AccountButton';
import { isReduceMotion, PressableScale } from './PressableScale';
import { Text, TextInput } from './Text';
import { sheet } from '../theme';

const NOTE_MAX = 20; // a word or two, like "Imtiaz" or "Rent", not a sentence
const PILL_MAX = 190;
const GAP = 10;
const OPEN_MS = 200;
const CLOSE_MS = 150; // the system answering is quicker than the person asking
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// The row above the keypad: the account button on the left and the Note pill on the right.
// Tapping the pill morphs it: it grows to the left, up to the edge of the account button, and becomes a
// text field, then shrinks back into the pill. The screen owns `open`; the row asks to close on Done,
// blur or the keyboard going away.
//
// Nothing else on the page moves while it opens: the keyboard slides over the keypad, and only if it would
// cover this row does the row lift (a transform, on the native thread) to sit just above it.
export function NoteRow({ left, value, onChange, placeholder, open, onOpen, onClose }: {
  left: ReactNode;
  value: string;
  onChange: (note: string) => void;
  placeholder: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const t = useRef(new Animated.Value(0)).current; // 0 = pill, 1 = field. Drives the width and the two fades.
  const lift = useRef(new Animated.Value(0)).current; // native: moves the row above the keyboard
  const liftTo = useRef(0);
  const row = useRef<View>(null);
  const [rowWidth, setRowWidth] = useState(0);
  const [leftWidth, setLeftWidth] = useState(0);
  const [pillWidth, setPillWidth] = useState(0);

  function run(anim: Animated.Value, to: number, duration: number, native: boolean) {
    if (isReduceMotion()) return anim.setValue(to);
    Animated.timing(anim, { toValue: to, duration, easing: EASE_OUT, useNativeDriver: native }).start();
  }

  useEffect(() => {
    run(t, open ? 1 : 0, open ? OPEN_MS : CLOSE_MS, false);
    if (!open) {
      liftTo.current = 0;
      run(lift, 0, CLOSE_MS, true);
    }
  }, [open, t, lift]);

  useEffect(() => {
    if (!open) return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      row.current?.measureInWindow((_x, y, _w, h) => {
        const resting = y + h - liftTo.current; // where the row's bottom edge sits with no lift
        liftTo.current = -Math.max(0, resting - (e.endCoordinates.screenY - 8));
        run(lift, liftTo.current, OPEN_MS, true);
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', onClose);
    return () => {
      show.remove();
      hide.remove();
    };
  }, [open, onClose, lift]);

  const to = (from: number, end: number) => t.interpolate({ inputRange: [0, 1], outputRange: [from, end] });
  // The pill's contents leave before the field's arrive, so the two never show on top of each other.
  const pillOpacity = t.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp' });
  const fieldOpacity = t.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const pillContent = (
    <>
      <StickyNote color={sheet.ink2} size={18} />
      <Text style={[styles.label, !value && { color: sheet.ink2 }]} numberOfLines={1}>{value || 'Add note'}</Text>
    </>
  );

  return (
    <Animated.View
      ref={row}
      style={[styles.row, { transform: [{ translateY: lift }] }]}
      onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
    >
      <View style={styles.left} onLayout={(e) => setLeftWidth(e.nativeEvent.layout.width)}>{left}</View>

      {/* Reserves the pill's space in the row; the visible pill below is drawn over it and can grow past it. */}
      <View style={styles.slot} onLayout={(e) => setPillWidth(e.nativeEvent.layout.width)}>{pillContent}</View>

      {rowWidth > 0 && leftWidth > 0 && pillWidth > 0 && (
        <Animated.View
          style={[
            styles.morph,
            { width: to(pillWidth, rowWidth - leftWidth - GAP) },
          ]}
        >
          <Animated.View pointerEvents={open ? 'none' : 'auto'} style={[styles.fill, { opacity: pillOpacity }]}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={value ? `Note: ${value}. Tap to edit` : 'Add a note'}
              onPress={onOpen}
              style={styles.pill}
            >
              {pillContent}
            </PressableScale>
          </Animated.View>
          <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[styles.fill, { opacity: fieldOpacity }]}>
            {open && (
              <TextInput
                autoFocus
                value={value}
                onChangeText={onChange}
                onBlur={onClose}
                returnKeyType="done"
                maxLength={NOTE_MAX}
                placeholder={placeholder}
                placeholderTextColor={sheet.ink3}
                style={styles.input}
              />
            )}
          </Animated.View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: GAP, marginBottom: 10 },
  left: { flexShrink: 1 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 8, height: BUTTON_HEIGHT, maxWidth: PILL_MAX, paddingHorizontal: 14, opacity: 0 },
  morph: { position: 'absolute', right: 0, top: 0, height: BUTTON_HEIGHT, borderRadius: BUTTON_HEIGHT / 2, backgroundColor: sheet.card, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  label: { flexShrink: 1, color: sheet.ink, fontSize: 15, fontWeight: '600' },
  input: { flex: 1, paddingHorizontal: 16, color: sheet.ink, fontSize: 16 },
});
