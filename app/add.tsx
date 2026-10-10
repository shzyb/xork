import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowDown, ChevronLeft, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { isReduceMotion, PressableScale } from '../src/components/PressableScale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountButton, AccountPicker } from '../src/components/AccountButton';
import { Button } from '../src/components/Button';
import { CategoryGrid } from '../src/components/CategoryGrid';
import { DateButton } from '../src/components/DateButton';
import { Keypad } from '../src/components/Keypad';
import { NoteRow } from '../src/components/NoteRow';
import { TypeSwitch } from '../src/components/TypeSwitch';
import { addTransaction, checkCreditLimit, getAccountsWithBalance, getCategories, getTransaction, isOverLimit, updateTransaction } from '../src/db';
import { today } from '../src/dates';
import { creditStatus } from '../src/insights';
import { currentDecimals, currentSymbol, formatMoney, formatTyped, minorToTyped, parseAmount } from '../src/money';
import { sheet, spacing } from '../src/theme';
import type { Account, Category, TransactionRow, TransactionType } from '../src/types';
import { useData } from '../src/useData';
import { Text } from '../src/components/Text';

const EDIT_TITLES = { expense: 'Edit expense', income: 'Edit income', transfer: 'Edit transfer' };
const SAVE_LABELS = { expense: 'Add expense', income: 'Add income', transfer: 'Move money' };
const NOTE_PLACEHOLDERS = { expense: 'Place or note', income: 'From who?', transfer: 'Note' };

// With ?id=5 the form edits that transaction; without it, it adds a new one, starting as ?type= (default expense).
export default function Add() {
  const { id, type } = useLocalSearchParams<{ id?: string; type?: string }>();
  const accounts = useData(getAccountsWithBalance);
  const categories = useData(getCategories);
  const editing = useData(() => (id ? getTransaction(Number(id)) : Promise.resolve(null)), [id]);

  if (!accounts || !categories || editing === undefined) return null;
  const startType = type === 'income' || type === 'transfer' ? type : 'expense';
  return <AddForm accounts={accounts} categories={categories} editing={editing} startType={startType} />;
}

function AddForm({ accounts, categories, editing, startType }: {
  accounts: (Account & { balance_minor: number })[];
  categories: Category[];
  editing: TransactionRow | null;
  startType: TransactionType;
}) {
  const router = useRouter();

  const [type, setType] = useState(editing?.type ?? startType);
  const [amount, setAmount] = useState(editing ? minorToTyped(editing.amount_minor) : '');
  const [fromSel, setFromSel] = useState<number | null>(editing?.account_id ?? null);
  const [toSel, setToSel] = useState<number | null>(editing?.to_account_id ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(editing?.category_id ?? null);
  const [note, setNote] = useState(editing?.note ?? '');
  const [date, setDate] = useState(editing?.date ?? today());
  const [error, setError] = useState('');
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const keypadOpacity = useRef(new Animated.Value(1)).current;

  // The keyboard slides over the keypad while the note is open, so the keypad just fades; nothing moves.
  useEffect(() => {
    const to = noteOpen ? 0 : 1;
    if (isReduceMotion()) keypadOpacity.setValue(to);
    else Animated.timing(keypadOpacity, { toValue: to, duration: noteOpen ? 150 : 200, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }).start();
  }, [noteOpen, keypadOpacity]);

  const fromId = fromSel ?? accounts[0].id;
  const toId = toSel ?? accounts.find((a) => a.id !== fromId)?.id ?? fromId;
  const from = accounts.find((a) => a.id === fromId) ?? accounts[0];
  const to = accounts.find((a) => a.id === toId) ?? from;
  const minor = parseAmount(amount);
  const decimals = currentDecimals();

  // The amount, account, note and date carry over. Expense and income have separate categories, so that is cleared.
  function switchType(next: TransactionType) {
    setType(next);
    setCategoryId(null);
    setError('');
  }

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

  const draft = () => ({
    type,
    amount_minor: minor,
    account_id: fromId,
    to_account_id: type === 'transfer' ? toId : null,
    category_id: type === 'transfer' ? null : categoryId,
    note: note.trim(),
    date,
  });

  async function save() {
    if (minor <= 0) return setError('Enter an amount above zero.');
    if (type === 'transfer') {
      if (accounts.length < 2) return setError('Add a second account to move money.');
      if (fromId === toId) return setError('Choose two different accounts.');
    } else if (categoryId === null) {
      return setError('Pick a category.');
    }
    try {
      await checkCreditLimit(draft(), editing?.id);
      if (editing) await updateTransaction(editing.id, draft());
      else await addTransaction(draft());
      router.back();
    } catch (e) {
      setError(isOverLimit(e) ? e.message : 'Could not save. Try again.');
    }
  }

  // For a credit card, show what is left and warn as the typed amount takes it near the limit.
  const card = from.type === 'credit' && from.limit_minor ? from : null;
  const oldOutflow = card && editing && editing.account_id === card.id ? (editing.type === 'income' ? -editing.amount_minor : editing.amount_minor) : 0;
  const cardOwed = card ? -card.balance_minor - oldOutflow + (type === 'income' ? -minor : minor) : 0;
  const cardStatus = card?.limit_minor ? creditStatus(cardOwed, card.limit_minor) : null;
  let underText = '';
  let underColor: string | undefined;
  if (card?.limit_minor && cardStatus) {
    const verb = minor > 0 ? 'would be' : 'is';
    if (cardOwed > card.limit_minor) {
      underText = `${formatMoney(cardOwed - card.limit_minor)} over the limit on ${card.name}`;
      underColor = sheet.neg;
    } else if (cardStatus.state === 'full') {
      underText = `${card.name} ${verb} at its limit`;
      underColor = sheet.neg;
    } else if (cardStatus.state === 'ok') {
      underText = `${card.name}: ${formatMoney(cardStatus.left)} left of ${formatMoney(card.limit_minor)}`;
    } else {
      underText = `${card.name} ${verb} at ${cardStatus.percent}% of its limit`;
      underColor = cardStatus.state === 'warn' ? sheet.warn : sheet.neg;
    }
  }

  const kindCategories = categories.filter((c) => c.kind === type);
  const fromLabel = type === 'income' ? 'Into' : 'From';

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        {editing ? (
          <RoundButton label="Close" onPress={() => router.back()}><X color={sheet.ink} size={18} /></RoundButton>
        ) : (
          <RoundButton label="Back to menu" onPress={() => router.replace('/add-menu')}>
            <ChevronLeft color={sheet.ink} size={20} />
          </RoundButton>
        )}
        {editing ? <Text style={styles.headerTitle}>{EDIT_TITLES[type]}</Text> : <TypeSwitch value={type} onChange={switchType} />}
        <DateButton value={date} onChange={setDate} />
      </View>

      <Pressable accessible={false} onPress={Keyboard.dismiss} disabled={!noteOpen} style={styles.amountBox}>
        <Text
          style={[styles.amount, !amount && { color: sheet.ink3 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          <Text style={styles.symbol}>{currentSymbol()} </Text>
          {amount ? formatTyped(amount) : '0'}
        </Text>
        {underText !== '' && <Text style={[styles.under, underColor !== undefined && { color: underColor, fontWeight: '600' }]}>{underText}</Text>}
        {error !== '' && <Text style={styles.error}>{error}</Text>}
      </Pressable>

      <View style={styles.footer}>
        <NoteRow
          left={<AccountButton account={from} label={fromLabel} onPress={() => setPicker('from')} />}
          value={note}
          onChange={setNote}
          placeholder={NOTE_PLACEHOLDERS[type]}
          open={noteOpen}
          onOpen={() => setNoteOpen(true)}
          onClose={() => setNoteOpen(false)}
        />
        {type === 'transfer' && (
          <View style={styles.toRow}>
            <ArrowDown color={sheet.ink3} size={18} />
            <AccountButton account={to} label="To" onPress={() => setPicker('to')} />
          </View>
        )}
        {type !== 'transfer' && (
          <CategoryGrid categories={kindCategories} selectedId={categoryId} onSelect={(id) => { setCategoryId(id); setError(''); }} />
        )}
        <Animated.View pointerEvents={noteOpen ? 'none' : 'auto'} style={{ opacity: keypadOpacity }}>
          <Keypad onKey={pressKey} decimals={decimals} />
        </Animated.View>
        <Button
          title={editing ? 'Save changes' : SAVE_LABELS[type]}
          onPress={save}
          background={minor > 0 ? sheet.btnBg : sheet.card2}
          color={minor > 0 ? sheet.btnFg : sheet.ink3}
        />
      </View>

      {picker !== null && (
        <AccountPicker
          title={picker === 'from' ? fromLabel : 'To'}
          accounts={accounts}
          current={picker === 'from' ? fromId : toId}
          onPick={(id) => { (picker === 'from' ? setFromSel : setToSel)(id); setError(''); setPicker(null); }}
          onClose={() => setPicker(null)}
        />
      )}
    </SafeAreaView>
  );
}

function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.round}>
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sheet.bg, paddingHorizontal: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  headerTitle: { color: sheet.ink, fontSize: 17, fontWeight: '600' },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: sheet.card, alignItems: 'center', justifyContent: 'center' },
  toRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, paddingLeft: 14 },
  amountBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  amount: { color: sheet.ink, fontSize: 68, fontWeight: '800', letterSpacing: -2, maxWidth: '100%' },
  symbol: { color: sheet.ink2, fontSize: 32, fontWeight: '700', letterSpacing: 0 },
  under: { color: sheet.ink2, fontSize: 15, marginTop: 10, textAlign: 'center' },
  error: { color: sheet.neg, fontSize: 14.5, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  footer: { paddingTop: 6, paddingBottom: spacing.lg },
});
