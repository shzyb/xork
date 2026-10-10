import { StickyNote } from 'lucide-react-native';
import { useEffect } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { BUTTON_HEIGHT } from './AccountButton';
import { PressableScale } from './PressableScale';
import { Text, TextInput } from './Text';
import { sheet } from '../theme';

// A "Note" pill that shows the note once there is one. While `open` it fills the row as a text field;
// the screen decides when to open it (and animates the change), and it asks to close on Done, blur or the keyboard going away.
export function NoteButton({ value, onChange, placeholder, open, onOpen, onClose }: {
  value: string;
  onChange: (note: string) => void;
  placeholder: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const sub = Keyboard.addListener('keyboardDidHide', onClose);
    return () => sub.remove();
  }, [open, onClose]);

  return (
    <View style={open ? styles.flex : styles.shrink}>
      {open ? (
        <TextInput
          autoFocus
          value={value}
          onChangeText={onChange}
          onBlur={onClose}
          returnKeyType="done"
          maxLength={60}
          placeholder={placeholder}
          placeholderTextColor={sheet.ink3}
          style={styles.input}
        />
      ) : (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={value ? `Note: ${value}. Tap to edit` : 'Add a note'}
          onPress={onOpen}
          style={[styles.pill, { backgroundColor: value ? sheet.card2 : sheet.card }]}
        >
          <StickyNote color={value ? sheet.ink : sheet.ink2} size={18} />
          <Text style={[styles.label, !value && { color: sheet.ink2 }]} numberOfLines={1}>{value || 'Note'}</Text>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1, maxWidth: 190 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: BUTTON_HEIGHT, paddingHorizontal: 14, borderRadius: BUTTON_HEIGHT / 2 },
  label: { flexShrink: 1, color: sheet.ink, fontSize: 15, fontWeight: '600' },
  input: { height: BUTTON_HEIGHT, borderRadius: BUTTON_HEIGHT / 2, backgroundColor: sheet.card, paddingHorizontal: 16, color: sheet.ink, fontSize: 16 },
});
