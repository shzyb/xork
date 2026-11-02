import { useRouter } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FadeScrollView } from '../src/components/FadeScrollView';
import { PressableScale } from '../src/components/PressableScale';
import { Button } from '../src/components/Button';
import { PickerSheet } from '../src/components/PickerSheet';
import { Sheet } from '../src/components/Sheet';
import { SheetHeader } from '../src/components/SheetHeader';
import { Text } from '../src/components/Text';
import { getPayday, getSalaryTransactions, setPayday } from '../src/db';
import { fullDate, ordinalDay } from '../src/dates';
import { formatMoney } from '../src/money';
import { sheet, spacing } from '../src/theme';
import type { Payday, TransactionRow } from '../src/types';
import { useData } from '../src/useData';

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: ordinalDay(i + 1) }));

export default function PaydayScreen() {
  const saved = useData(getPayday);
  const salaries = useData(getSalaryTransactions);
  if (saved === undefined || salaries === undefined) return null;
  return <PaydayForm saved={saved} salaries={salaries} />;
}

function PaydayForm({ saved, salaries }: { saved: Payday; salaries: TransactionRow[] }) {
  const router = useRouter();
  const [mode, setMode] = useState(saved.mode);
  const [startDay, setStartDay] = useState(saved.mode === 'start' ? saved.startDay : 1);
  const [salaryId, setSalaryId] = useState(saved.mode === 'salary' ? saved.salaryId : null);
  const [pickerOpen, setPickerOpen] = useState<'day' | 'salary' | null>(null);
  const [error, setError] = useState('');
  const chosen = salaries.find((s) => s.id === salaryId) ?? null;

  async function save() {
    if (mode === 'salary' && salaryId === null) return setError('Choose a salary transaction.');
    try {
      await setPayday(mode === 'start' ? { mode, startDay } : { mode, salaryId });
      router.back();
    } catch {
      setError('Could not save. Try again.');
    }
  }

  return (
    <Sheet onClose={() => router.back()}>
      <SheetHeader title="Payday" onClose={() => router.back()} />
      <FadeScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Option
          title="Start date"
          text="The calculation will be based on the start date of the month."
          on={mode === 'start'}
          onPress={() => { setMode('start'); setError(''); }}
        />
        <Option
          title="Salary"
          text="The calculation will be based on a salary transaction you pick."
          on={mode === 'salary'}
          onPress={() => { setMode('salary'); setError(''); }}
        />
        {mode === 'start' ? (
          <PressableScale accessibilityRole="button" onPress={() => setPickerOpen('day')} style={styles.field}>
            <View style={styles.main}>
              <Text style={styles.fieldTitle}>Month starts on</Text>
              <Text style={styles.sub}>Normally this would be the date you take your salary.</Text>
            </View>
            <Text style={styles.value}>{ordinalDay(startDay)}</Text>
            <ChevronRight color={sheet.ink3} size={20} />
          </PressableScale>
        ) : (
          <PressableScale accessibilityRole="button" onPress={() => setPickerOpen('salary')} style={styles.field}>
            <View style={styles.main}>
              <Text style={styles.fieldTitle}>Salary transaction</Text>
              <Text style={styles.sub}>
                {chosen ? `${fullDate(chosen.date)} · ${formatMoney(chosen.amount_minor)}` : 'No salary picked yet.'}
              </Text>
              <Text style={styles.hint}>Tap to select another income transaction to use for calculation.</Text>
            </View>
            <ChevronRight color={sheet.ink3} size={20} />
          </PressableScale>
        )}
        {error !== '' && <Text style={styles.error}>{error}</Text>}
      </FadeScrollView>
      <View style={styles.footer}>
        <Button title="Save" onPress={save} background={sheet.btnBg} color={sheet.btnFg} />
      </View>
      {pickerOpen === 'day' && (
        <PickerSheet
          title="Month starts on"
          options={DAY_OPTIONS}
          current={startDay}
          onPick={(day) => { setStartDay(day); setPickerOpen(null); }}
          onClose={() => setPickerOpen(null)}
        />
      )}
      {pickerOpen === 'salary' && (
        <PickerSheet
          title="Salary transaction"
          options={salaries.map((s) => ({ value: s.id, label: fullDate(s.date), sub: formatMoney(s.amount_minor) }))}
          current={salaryId}
          onPick={(id) => { setSalaryId(id); setError(''); setPickerOpen(null); }}
          onClose={() => setPickerOpen(null)}
        />
      )}
    </Sheet>
  );
}

function Option({ title, text, on, onPress }: { title: string; text: string; on: boolean; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={styles.option}>
      <View style={styles.main}>
        <Text style={styles.fieldTitle}>{title}</Text>
        <Text style={styles.sub}>{text}</Text>
      </View>
      {on && <Check color={sheet.pos} size={20} strokeWidth={2.6} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  content: { paddingBottom: spacing.lg },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 4 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, marginTop: 14, paddingVertical: 4 },
  main: { flex: 1, gap: 2 },
  fieldTitle: { color: sheet.ink, fontSize: 16.5, fontWeight: '600' },
  sub: { color: sheet.ink2, fontSize: 14, lineHeight: 19 },
  hint: { color: sheet.ink3, fontSize: 13, lineHeight: 18, marginTop: 4 },
  value: { color: sheet.ink, fontSize: 16.5, fontWeight: '600' },
  error: { color: sheet.neg, fontSize: 14.5, fontWeight: '600', marginTop: 14, textAlign: 'center' },
  footer: { paddingTop: 10, paddingBottom: spacing.lg },
});
