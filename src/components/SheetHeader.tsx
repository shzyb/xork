import { X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { sheet, spacing } from '../theme';
import { Text } from './Text';

export function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <PressableScale accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
        <X color={sheet.ink} size={18} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  title: { color: sheet.ink, fontSize: 22, fontWeight: '700', flex: 1 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: sheet.card, alignItems: 'center', justifyContent: 'center' },
});
