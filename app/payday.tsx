import { useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FadeScrollView } from '../src/components/FadeScrollView';
import { PressableScale } from '../src/components/PressableScale';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { getPayday, getSalaryTransactions, setPayday } from '../src/db';
import { fullDate, ordinalDay } from '../src/dates';
import { formatMoney } from '../src/money';
import { fontSize, spacing, useColors } from '../src/theme';
import type { Payday, TransactionRow } from '../src/types';
import { useData } from '../src/useData';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// Settings → Payday. Pick how a period starts: a day of the month, or a salary transaction.
export default function PaydayScreen() {
  const saved = useData(getPayday);
  const salaries = useData(getSalaryTransactions);
  if (saved === undefined || salaries === undefined) return null;
  return <PaydayForm saved={saved} salaries={salaries} />;
}

function PaydayForm({ saved, salaries }: { saved: Payday; salaries: TransactionRow[] }) {
  const colors = useColors();
  const router = useRouter();
  const [mode, setMode] = useState(saved.mode);
  const [startDay, setStartDay] = useState(saved.mode === 'start' ? saved.startDay : 1);
  const [salaryId, setSalaryId] = useState(saved.mode === 'salary' ? saved.salaryId : null);
  const [error, setError] = useState('');
  const chosen = salaries.find((s) => s.id === salaryId) ?? null;

  function choose(next: Payday['mode']) {
    setMode(next);
    setError('');
  }

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
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <PressableScale accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <ChevronLeft color={colors.ink} size={26} />
      </PressableScale>
      <Text style={[styles.title, { color: colors.ink }]}>Payday</Text>
      <View style={styles.pills}>
        <Pill label="Start date" on={mode === 'start'} onPress={() => choose('start')} />
        <Pill label="Salary" on={mode === 'salary'} onPress={() => choose('salary')} />
      </View>
      <FadeScrollView style={styles.flex} contentContainerStyle={styles.content}>
        {mode === 'start' ? (
          <>
            <Text style={[styles.intro, { color: colors.ink2 }]}>The calculation will be based on the start date of the month.</Text>
            <View style={[styles.field, { backgroundColor: colors.fill }]}>
              <Text style={[styles.fieldLabel, { color: colors.ink2 }]}>Month starts on</Text>
              <Text style={[styles.fieldValue, { color: colors.ink }]}>{ordinalDay(startDay)}</Text>
              <Text style={[styles.hint, { color: colors.ink2 }]}>Normally this would be the date you take your salary.</Text>
            </View>
            <View style={styles.days}>
              {DAYS.map((day) => (
                <PressableScale
                  key={day}
                  accessibilityRole="button"
                  accessibilityLabel={`Month starts on the ${ordinalDay(day)}`}
                  accessibilityState={{ selected: day === startDay }}
                  onPress={() => { setStartDay(day); setError(''); }}
                  style={[styles.day, { backgroundColor: day === startDay ? colors.ink : colors.fill }]}
                >
                  <Text style={[styles.dayText, { color: day === startDay ? colors.bg : colors.ink }]}>{day}</Text>
                </PressableScale>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.intro, { color: colors.ink2 }]}>The calculation will be based on a salary transaction you pick.</Text>
            <View style={[styles.field, { backgroundColor: colors.fill }]}>
              <Text style={[styles.fieldLabel, { color: colors.ink2 }]}>Salary transaction</Text>
              <Text style={[styles.fieldValue, { color: colors.ink }]}>
                {chosen ? `${fullDate(chosen.date)} · ${formatMoney(chosen.amount_minor)}` : 'None picked'}
              </Text>
              <Text style={[styles.hint, { color: colors.ink2 }]}>Tap to select another income transaction to use for calculation.</Text>
            </View>
            {salaries.length === 0 && <Text style={[styles.hint, { color: colors.ink2 }]}>No salary transactions yet.</Text>}
            {salaries.map((s) => {
              const on = s.id === salaryId;
              return (
                <PressableScale
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => { setSalaryId(s.id); setError(''); }}
                  style={styles.row}
                >
                  <View style={styles.rowMain}>
                    <Text style={[styles.rowTitle, { color: colors.ink }]}>{fullDate(s.date)}</Text>
                    <Text style={[styles.hint, { color: colors.ink2 }]}>{formatMoney(s.amount_minor)}</Text>
                  </View>
                  {on && <Check color={colors.pos} size={20} strokeWidth={2.6} />}
                </PressableScale>
              );
            })}
          </>
        )}
        {error !== '' && <Text style={[styles.error, { color: colors.neg }]}>{error}</Text>}
      </FadeScrollView>
      <View style={styles.footer}>
        <Button title="Save" onPress={save} background={colors.btnBg} color={colors.btnFg} />
      </View>
    </SafeAreaView>
  );
}

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.pill, { backgroundColor: on ? colors.ink : colors.fill }]}
    >
      <Text style={[styles.pillText, { color: on ? colors.bg : colors.ink2 }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  flex: { flex: 1 },
  back: { width: 44, height: 44, marginLeft: -10, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize.screen, fontWeight: '800' },
  pills: { flexDirection: 'row', gap: 8, marginTop: spacing.lg },
  pill: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 15, fontWeight: '600' },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.lg, gap: 14 },
  intro: { fontSize: 15, lineHeight: 21 },
  field: { borderRadius: 16, padding: 16, gap: 4 },
  fieldLabel: { fontSize: 13.5, fontWeight: '600' },
  fieldValue: { fontSize: 22, fontWeight: '700' },
  hint: { fontSize: 13.5, lineHeight: 19 },
  days: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  day: { width: '14.28%', aspectRatio: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dayText: { width: '100%', fontSize: 15, lineHeight: 15, fontWeight: '600', textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  error: { fontSize: 14.5, fontWeight: '600', textAlign: 'center' },
  footer: { paddingTop: 10, paddingBottom: spacing.lg },
});
