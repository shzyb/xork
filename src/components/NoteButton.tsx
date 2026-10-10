import { StickyNote } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, StyleSheet } from 'react-native';
import { BUTTON_HEIGHT } from './AccountButton';
import { PressableScale } from './PressableScale';
import { Sheet } from './Sheet';
import { SheetHeader } from './SheetHeader';
import { TextInput } from './Text';
import { sheet } from '../theme';

// A round icon button for the note. Tapping it opens a small tray with the text field; the icon lights up once there is a note.
export function NoteButton({ value, onChange, placeholder }: { value: string; onChange: (note: string) => void; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={value ? 'Edit note' : 'Add a note'}
        onPress={() => setOpen(true)}
        style={[styles.button, { backgroundColor: value ? sheet.card2 : sheet.card }]}
      >
        <StickyNote color={value ? sheet.ink : sheet.ink2} size={20} />
      </PressableScale>

      {open && (
        <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
          <KeyboardAvoidingView style={styles.flex} behavior="padding">
            <Sheet onClose={close} color={sheet.card2}>
              <SheetHeader title="Note" onClose={close} />
              <TextInput
                autoFocus
                value={value}
                onChangeText={onChange}
                onSubmitEditing={close}
                returnKeyType="done"
                maxLength={60}
                placeholder={placeholder}
                placeholderTextColor={sheet.ink3}
                style={styles.input}
              />
            </Sheet>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  button: { width: BUTTON_HEIGHT, height: BUTTON_HEIGHT, borderRadius: BUTTON_HEIGHT / 2, alignItems: 'center', justifyContent: 'center' },
  input: { height: 50, borderRadius: 16, backgroundColor: sheet.card, paddingHorizontal: 14, marginBottom: 12, color: sheet.ink, fontSize: 16 },
});
