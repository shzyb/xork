import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { BUTTON_HEIGHT } from './AccountButton';
import { PickerSheet } from './PickerSheet';
import type { PickerOption } from './PickerSheet';
import { PressableScale } from './PressableScale';
import { Sheet } from './Sheet';
import { SheetHeader } from './SheetHeader';
import { fromDay, prettyDate, toDay, today, yesterday } from '../dates';
import { sheet } from '../theme';

type Choice = 'today' | 'yesterday' | 'pick';

// A round calendar button. It lights up when the date is not today. Tapping it opens Today, Yesterday and Pick a date.
export function DateButton({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [iosPickerOpen, setIosPickerOpen] = useState(false);

  const current: Choice = value === today() ? 'today' : value === yesterday() ? 'yesterday' : 'pick';
  const options: PickerOption<Choice>[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'pick', label: 'Pick a date', sub: current === 'pick' ? prettyDate(value) : undefined },
  ];

  function choose(choice: Choice) {
    setSheetOpen(false);
    if (choice === 'today') return onChange(today());
    if (choice === 'yesterday') return onChange(yesterday());
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: fromDay(value), mode: 'date', onValueChange: (_, picked) => onChange(toDay(picked)) });
    } else {
      setIosPickerOpen(true);
    }
  }

  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Date: ${prettyDate(value)}. Tap to change`}
        onPress={() => setSheetOpen(true)}
        style={[styles.button, { backgroundColor: current === 'today' ? sheet.card : sheet.card2 }]}
      >
        <Calendar color={current === 'today' ? sheet.ink2 : sheet.ink} size={19} />
      </PressableScale>

      {sheetOpen && <PickerSheet title="Date" options={options} current={current} onPick={choose} onClose={() => setSheetOpen(false)} color={sheet.card2} />}

      {iosPickerOpen && (
        <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={() => setIosPickerOpen(false)}>
          <View style={styles.dim}>
            <Sheet onClose={() => setIosPickerOpen(false)} color={sheet.card2}>
              <SheetHeader title="Pick a date" onClose={() => setIosPickerOpen(false)} />
              <DateTimePicker
                value={fromDay(value)}
                mode="date"
                display="inline"
                themeVariant="dark"
                accentColor={sheet.ink}
                onValueChange={(_, picked) => onChange(toDay(picked))}
              />
            </Sheet>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  button: { width: BUTTON_HEIGHT, height: BUTTON_HEIGHT, borderRadius: BUTTON_HEIGHT / 2, alignItems: 'center', justifyContent: 'center' },
  dim: { flex: 1 },
});
