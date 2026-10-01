import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { fromDay, prettyDate, toDay } from '../dates';
import { sheet } from '../theme';
import { Text } from './Text';

// Date choice for the black sheet: a few preset chips (e.g. Today, Yesterday) plus a "Pick a date" chip.
export function DateChips({ value, onChange, presets }: {
  value: string;
  onChange: (date: string) => void;
  presets: { label: string; date: string }[];
}) {
  const [showPicker, setShowPicker] = useState(false);
  const custom = !presets.some((p) => p.date === value);

  function pick() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: fromDay(value),
        mode: 'date',
        onValueChange: (_, picked) => onChange(toDay(picked)),
      });
    } else {
      setShowPicker(!showPicker);
    }
  }

  return (
    <>
      <View style={styles.chips}>
        {presets.map((p) => (
          <Chip
            key={p.label}
            label={p.label}
            on={p.date === value}
            onPress={() => { onChange(p.date); setShowPicker(false); }}
          />
        ))}
        <Chip label={custom ? prettyDate(value) : 'Pick a date'} on={custom} icon onPress={pick} />
      </View>
      {showPicker && Platform.OS === 'ios' && (
        <View style={styles.pickerCard}>
          <DateTimePicker
            value={fromDay(value)}
            mode="date"
            display="inline"
            themeVariant="dark"
            accentColor={sheet.ink}
            onValueChange={(_, picked) => onChange(toDay(picked))}
          />
        </View>
      )}
    </>
  );
}

function Chip({ label, on, icon, onPress }: { label: string; on: boolean; icon?: boolean; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: on ? sheet.btnBg : sheet.card }]}
    >
      {icon && <Calendar color={on ? sheet.btnFg : sheet.ink2} size={15} />}
      <Text style={[styles.chipText, { color: on ? sheet.btnFg : sheet.ink }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20 },
  chipText: { fontSize: 14.5, fontWeight: '600' },
  pickerCard: { backgroundColor: sheet.card, borderRadius: 20, marginTop: 10, padding: 8 },
});
