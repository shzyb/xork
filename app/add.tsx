import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Calendar, ChevronLeft, Delete, X } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { CategoryIcon } from '../src/components/CategoryIcon';
import { addTransaction, getAccountsWithBalance, getCategories } from '../src/db';
import { fromDay, prettyDate, toDay, today, yesterday } from '../src/dates';
import { currentDecimals, currentSymbol, formatMoney, formatTyped, parseAmount } from '../src/money';
import { sheet, spacing } from '../src/theme';
import type { TransactionType } from '../src/types';
import { useData } from '../src/useData';

const TYPES: { key: TransactionType; label: string }[] = [
  { key: 'expense', label: 'Expense' },
  { key: 'income', label: 'Income' },
  { key: 'transfer', label: 'Move' },
];
const TITLES = { expense: 'Expense', income: 'Income', transfer: 'Move money' };
const SAVE_LABELS = { expense: 'Add expense', income: 'Add income', transfer: 'Move money' };
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

export default function Add() {
  const router = useRouter();
  const accounts = useData(getAccountsWithBalance);
  const categories = useData(getCategories);

  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [fromSel, setFromSel] = useState<number | null>(null);
  const [toSel, setToSel] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today());
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState('');

  if (!accounts || !categories) return null;

  const fromId = fromSel ?? accounts[0].id;
  const toId = toSel ?? accounts.find((a) => a.id !== fromId)?.id ?? fromId;
  const from = accounts.find((a) => a.id === fromId) ?? accounts[0];
  const to = accounts.find((a) => a.id === toId) ?? from;
  const minor = parseAmount(amount);
  const decimals = currentDecimals();

  function pressKey(key: string) {
    setError('');
    if (key === 'back') return setAmount(amount.slice(0, -1));
    if (key === '.') {
      if (decimals === 0 || amount.includes('.')) return;
      return setAmount((amount || '0') + '.');
    }
    if (amount.includes('.')) {
      if (amount.split('.')[1].length >= decimals) return;
    } else if (amount.length >= 9) {
      return;
    }
    setAmount(amount === '0' ? key : amount + key);
  }

  function changeType(next: TransactionType) {
    setType(next);
    setCategoryId(null);
    setError('');
  }

  function goToDetails() {
    if (minor <= 0) return setError('Enter an amount above zero.');
    if (type === 'transfer') {
      if (accounts!.length < 2) return setError('Add a second account to move money.');
      if (fromId === toId) return setError('Choose two different accounts.');
    }
    setError('');
    setStep(2);
  }

  async function save() {
    if (type !== 'transfer' && categoryId === null) return setError('Pick a category.');
    try {
      await addTransaction({
        type,
        amount_minor: minor,
        account_id: fromId,
        to_account_id: type === 'transfer' ? toId : null,
        category_id: type === 'transfer' ? null : categoryId,
        note: note.trim(),
        date,
      });
      router.back();
    } catch {
      setError('Could not save. Try again.');
    }
  }

  function pickDate() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: fromDay(date),
        mode: 'date',
        onValueChange: (_, picked) => setDate(toDay(picked)),
      });
    } else {
      setShowPicker(!showPicker);
    }
  }

  const customDate = date !== today() && date !== yesterday();
  const kindCategories = categories.filter((c) => c.kind === type);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        {step === 1 ? (
          <RoundButton label="Close" onPress={() => router.back()}><X color={sheet.ink} size={18} /></RoundButton>
        ) : (
          <RoundButton label="Back" onPress={() => { setError(''); setStep(1); }}>
            <ChevronLeft color={sheet.ink} size={20} />
          </RoundButton>
        )}
        <Text style={styles.headerTitle}>{step === 1 ? TITLES[type] : type === 'transfer' ? 'Details' : type === 'income' ? 'Where from?' : 'What for?'}</Text>
        {step === 2 ? (
          <RoundButton label="Close" onPress={() => router.back()}><X color={sheet.ink} size={18} /></RoundButton>
        ) : (
          <View style={styles.roundSpacer} />
        )}
      </View>

      {step === 1 ? (
        <>
          <View style={styles.body}>
            <View style={styles.segment}>
              {TYPES.map((t) => (
                <Pressable
                  key={t.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: type === t.key }}
                  onPress={() => changeType(t.key)}
                  style={[styles.segmentItem, type === t.key && { backgroundColor: sheet.card2 }]}
                >
                  <Text style={[styles.segmentText, type === t.key && { color: sheet.ink }]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            <AccountChips
              label={type === 'income' ? 'Into' : 'From'}
              accounts={accounts}
              selectedId={fromId}
              onSelect={setFromSel}
            />
            {type === 'transfer' && (
              <AccountChips label="To" accounts={accounts} selectedId={toId} onSelect={setToSel} />
            )}

            <View style={styles.amountBox}>
              <Text
                style={[styles.amount, !amount && { color: sheet.ink3 }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                <Text style={styles.symbol}>{currentSymbol()} </Text>
                {amount ? formatTyped(amount) : '0'}
              </Text>
              <Text style={styles.under}>{from.name} has {formatMoney(from.balance_minor)}</Text>
              {error !== '' && <Text style={styles.error}>{error}</Text>}
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.keypad}>
              {KEYS.map((key) =>
                key === '.' && decimals === 0 ? (
                  <View key={key} style={styles.key} />
                ) : (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={key === 'back' ? 'Delete' : key}
                    onPress={() => pressKey(key)}
                    style={styles.key}
                  >
                    {key === 'back' ? <Delete color={sheet.ink} size={26} /> : <Text style={styles.keyText}>{key}</Text>}
                  </Pressable>
                ),
              )}
            </View>
            <Button
              title="Continue"
              onPress={goToDetails}
              background={minor > 0 ? sheet.btnBg : sheet.card2}
              color={minor > 0 ? sheet.btnFg : sheet.ink3}
            />
          </View>
        </>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.details} keyboardShouldPersistTaps="handled">
            <Pressable accessibilityRole="button" accessibilityLabel="Change amount" onPress={() => setStep(1)} style={styles.hero}>
              <Text style={[styles.heroAmount, type === 'income' && { color: sheet.pos }]}>
                {type === 'income' ? '+ ' : ''}{formatMoney(minor)}
              </Text>
              <Text style={styles.under}>
                {from.name}{type === 'transfer' ? ` → ${to.name}` : ''} · tap to change
              </Text>
            </Pressable>

            {type !== 'transfer' && (
              <>
                <Text style={styles.label}>Category</Text>
                <View style={styles.grid}>
                  {kindCategories.map((c) => (
                    <Pressable
                      key={c.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: categoryId === c.id }}
                      onPress={() => { setCategoryId(c.id); setError(''); }}
                      style={styles.cell}
                    >
                      <View style={categoryId === c.id && styles.cellSelected}>
                        <CategoryIcon name={c.icon} color={c.color} size={48} />
                      </View>
                      <Text style={[styles.cellText, categoryId === c.id && { color: sheet.ink }]} numberOfLines={2}>
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>
              {type === 'expense' ? 'Place or note' : type === 'income' ? 'From who or what' : 'Note'}
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={60}
              placeholder={type === 'expense' ? 'e.g. Imtiaz Supermarket' : type === 'income' ? 'e.g. September salary' : 'e.g. Monthly saving'}
              placeholderTextColor={sheet.ink3}
              style={styles.input}
            />

            <Text style={styles.label}>Date</Text>
            <View style={styles.chips}>
              <DateChip label="Today" on={date === today()} onPress={() => { setDate(today()); setShowPicker(false); }} />
              <DateChip label="Yesterday" on={date === yesterday()} onPress={() => { setDate(yesterday()); setShowPicker(false); }} />
              <DateChip label={customDate ? prettyDate(date) : 'Pick a date'} on={customDate} icon onPress={pickDate} />
            </View>
            {showPicker && Platform.OS === 'ios' && (
              <View style={styles.pickerCard}>
                <DateTimePicker
                  value={fromDay(date)}
                  mode="date"
                  display="inline"
                  themeVariant="dark"
                  accentColor={sheet.ink}
                  onValueChange={(_, picked) => setDate(toDay(picked))}
                />
              </View>
            )}

            {error !== '' && <Text style={styles.error}>{error}</Text>}
          </ScrollView>
          <View style={styles.footer}>
            <Button title={SAVE_LABELS[type]} onPress={save} background={sheet.btnBg} color={sheet.btnFg} />
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.round}>
      {children}
    </Pressable>
  );
}

function AccountChips({ label, accounts, selectedId, onSelect }: {
  label: string;
  accounts: { id: number; name: string; color: string }[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  return (
    <View style={styles.accountRow}>
      <Text style={styles.accountLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountChips}>
        {accounts.map((a) => (
          <Pressable
            key={a.id}
            accessibilityRole="button"
            accessibilityState={{ selected: a.id === selectedId }}
            onPress={() => onSelect(a.id)}
            style={[styles.accountChip, { backgroundColor: a.id === selectedId ? sheet.card2 : sheet.card }]}
          >
            <View style={[styles.accountDot, { backgroundColor: a.color }]}>
              <Text style={styles.accountInitial}>{a.name.trim().charAt(0).toUpperCase() || '?'}</Text>
            </View>
            <Text style={[styles.accountName, a.id !== selectedId && { color: sheet.ink2 }]} numberOfLines={1}>{a.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function DateChip({ label, on, icon, onPress }: { label: string; on: boolean; icon?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.dateChip, on ? { backgroundColor: sheet.btnBg } : { backgroundColor: sheet.card }]}
    >
      {icon && <Calendar color={on ? sheet.btnFg : sheet.ink2} size={15} />}
      <Text style={[styles.dateChipText, { color: on ? sheet.btnFg : sheet.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sheet.bg, paddingHorizontal: spacing.xl },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  headerTitle: { color: sheet.ink, fontSize: 17, fontWeight: '600' },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: sheet.card, alignItems: 'center', justifyContent: 'center' },
  roundSpacer: { width: 44 },
  body: { flex: 1 },
  segment: { flexDirection: 'row', backgroundColor: sheet.card, borderRadius: 22, padding: 3, gap: 3 },
  segmentItem: { flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  segmentText: { color: sheet.ink2, fontSize: 14.5, fontWeight: '600' },
  accountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: sheet.card, borderRadius: 16, marginTop: 10, paddingLeft: 14, minHeight: 54 },
  accountLabel: { color: sheet.ink2, fontSize: 15, minWidth: 44 },
  accountChips: { gap: 6, paddingVertical: 6, paddingRight: 8 },
  accountChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingLeft: 4, paddingRight: 12, borderRadius: 21 },
  accountDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  accountInitial: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  accountName: { color: sheet.ink, fontSize: 15, fontWeight: '600', maxWidth: 140 },
  amountBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  amount: { color: sheet.ink, fontSize: 68, fontWeight: '800', letterSpacing: -2, maxWidth: '100%' },
  symbol: { color: sheet.ink2, fontSize: 32, fontWeight: '700', letterSpacing: 0 },
  under: { color: sheet.ink2, fontSize: 15, marginTop: 10, textAlign: 'center' },
  error: { color: sheet.neg, fontSize: 14.5, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  footer: { paddingTop: 6, paddingBottom: spacing.lg },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  key: { width: '33.333%', height: 56, alignItems: 'center', justifyContent: 'center' },
  keyText: { color: sheet.ink, fontSize: 27, fontWeight: '500' },
  details: { paddingBottom: spacing.lg },
  hero: { alignItems: 'center', paddingVertical: 4 },
  heroAmount: { color: sheet.ink, fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  label: { color: sheet.ink2, fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '25%', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 2 },
  cellSelected: { padding: 3, borderRadius: 30, borderWidth: 2, borderColor: sheet.ink, margin: -5 },
  cellText: { color: sheet.ink2, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  input: { height: 50, borderRadius: 16, backgroundColor: sheet.card, paddingHorizontal: 14, color: sheet.ink, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20 },
  dateChipText: { fontSize: 14.5, fontWeight: '600' },
  pickerCard: { backgroundColor: sheet.card, borderRadius: 20, marginTop: 10, padding: 8 },
});
