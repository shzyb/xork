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
const MS = 240;

// The row above the keypad: the account button on the left and the Note pill on the right.
// Tapping the pill morphs it: it grows to the left over the whole row (the account button fades out) and
// becomes a text field, then shrinks back into the pill. The screen owns `open`; the row asks to close
// on Done, blur or the keyboard going away.
export function NoteRow({ left, value, onChange, placeholder, open, onOpen, onClose }: {
  left: ReactNode;
  value: string;
  onChange: (note: string) => void;
  placeholder: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const t = useRef(new Animated.Value(0)).current;
  const [rowWidth, setRowWidth] = useState(0);
  const [pillWidth, setPillWidth] = useState(0);

  useEffect(() => {
    if (isReduceMotion()) t.setValue(open ? 1 : 0);
    else Animated.timing(t, { toValue: open ? 1 : 0, duration: MS, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: false }).start();
  }, [open, t]);

  useEffect(() => {
    if (!open) return;
    const sub = Keyboard.addListener('keyboardDidHide', onClose);
    return () => sub.remove();
  }, [open, onClose]);

  const fade = (from: number, to: number) => t.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  const pillContent = (
    <>
      <StickyNote color={value ? sheet.ink : sheet.ink2} size={18} />
      <Text style={[styles.label, !value && { color: sheet.ink2 }]} numberOfLines={1}>{value || 'Note'}</Text>
    </>
  );

  return (
    <View style={styles.row} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
      <Animated.View pointerEvents={open ? 'none' : 'auto'} style={[styles.left, { opacity: fade(1, 0) }]}>{left}</Animated.View>

      {/* Reserves the pill's space in the row; the visible pill below is drawn over it and can grow past it. */}
      <View style={styles.slot} onLayout={(e) => setPillWidth(e.nativeEvent.layout.width)}>{pillContent}</View>

      {rowWidth > 0 && pillWidth > 0 && (
        <Animated.View
          style={[
            styles.morph,
            { width: fade(pillWidth, rowWidth), backgroundColor: fade(0, 1).interpolate({ inputRange: [0, 1], outputRange: [value ? sheet.card2 : sheet.card, sheet.card] }) },
          ]}
        >
          <Animated.View pointerEvents={open ? 'none' : 'auto'} style={[styles.fill, { opacity: fade(1, 0) }]}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={value ? `Note: ${value}. Tap to edit` : 'Add a note'}
              onPress={onOpen}
              style={styles.pill}
            >
              {pillContent}
            </PressableScale>
          </Animated.View>
          <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[styles.fill, { opacity: fade(0, 1) }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  left: { flexShrink: 1 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 8, height: BUTTON_HEIGHT, maxWidth: PILL_MAX, paddingHorizontal: 14, opacity: 0 },
  morph: { position: 'absolute', right: 0, top: 0, height: BUTTON_HEIGHT, borderRadius: BUTTON_HEIGHT / 2, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  label: { flexShrink: 1, color: sheet.ink, fontSize: 15, fontWeight: '600' },
  input: { flex: 1, paddingHorizontal: 16, color: sheet.ink, fontSize: 16 },
});
