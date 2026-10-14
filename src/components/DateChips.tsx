import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Chip } from './Chip';
import { fromDay, prettyDate, toDay } from '../dates';
import { sheet } from '../theme';

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
        <Chip label={custom ? prettyDate(value) : 'Pick a date'} on={custom} Icon={Calendar} onPress={pick} />
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

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerCard: { backgroundColor: sheet.card, borderRadius: 20, marginTop: 10, padding: 8 },
});
