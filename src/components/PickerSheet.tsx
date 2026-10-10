import { Check } from 'lucide-react-native';
import { FadeScrollView } from './FadeScrollView';
import type { ReactNode } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { sheet } from '../theme';
import { Sheet } from './Sheet';
import { SheetHeader } from './SheetHeader';
import { Text } from './Text';

export type PickerOption<T> = { value: T; label: string; sub?: string; lead?: ReactNode };

// A small "choose one" sheet over the current screen (for filters). Mount it to open it, unmount it to close it.
export function PickerSheet<T extends string | number | null>({ title, options, current, onPick, onClose, color }: {
  title: string;
  options: PickerOption<T>[];
  current: T;
  onPick: (value: T) => void;
  onClose: () => void;
  color?: string; // tray colour, when it opens over the black add page
}) {
  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.dim}>
        <Sheet onClose={onClose} color={color}>
          <SheetHeader title={title} onClose={onClose} />
          <FadeScrollView style={styles.list}>
            {options.map((o) => (
              <PressableScale
                key={String(o.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: o.value === current }}
                onPress={() => onPick(o.value)}
                style={styles.row}
              >
                {o.lead}
                <View style={styles.main}>
                  <Text style={styles.label}>{o.label}</Text>
                  {o.sub !== undefined && <Text style={styles.sub}>{o.sub}</Text>}
                </View>
                {o.value === current && <Check color={sheet.pos} size={20} strokeWidth={2.6} />}
              </PressableScale>
            ))}
          </FadeScrollView>
        </Sheet>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1 },
  list: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60 },
  main: { flex: 1 },
  label: { color: sheet.ink, fontSize: 16.5, fontWeight: '600' },
  sub: { color: sheet.ink2, fontSize: 14 },
});
