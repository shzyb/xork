import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { PressableScale } from './PressableScale';
import { sheet } from '../theme';
import { Text } from './Text';

// A choice pill for the black sheet: white when chosen, dark grey otherwise. Optional icon in front of the label.
export function Chip({ label, on, Icon, onPress }: { label: string; on: boolean; Icon?: LucideIcon; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: on ? sheet.btnBg : sheet.card }]}
    >
      {Icon && <Icon color={on ? sheet.btnFg : sheet.ink2} size={15} />}
      <Text style={[styles.text, { color: on ? sheet.btnFg : sheet.ink }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20 },
  text: { fontSize: 14.5, fontWeight: '600' },
});
