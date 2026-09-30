import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { ColorSwatches } from '../../src/components/ColorSwatches';
import { Field } from '../../src/components/Field';
import { SheetHeader } from '../../src/components/SheetHeader';
import { addAccount, deleteAccount, getAccount, getAccountsWithBalance, updateAccount } from '../../src/db';
import { currentDecimals, minorToTyped, parseAmount } from '../../src/money';
import { accountColors, sheet, spacing } from '../../src/theme';
import type { Account } from '../../src/types';
import { useData } from '../../src/useData';

// /account/new adds an account, /account/5 edits account 5.
export default function AccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const editing = useData(() => (isNew ? Promise.resolve(null) : getAccount(Number(id))), [id]);
  const accounts = useData(getAccountsWithBalance);

  if (editing === undefined || !accounts) return null;
  if (!isNew && editing === null) return null;
  return <AccountForm editing={editing} accountCount={accounts.length} />;
}

function AccountForm({ editing, accountCount }: { editing: Account | null; accountCount: number }) {
  const router = useRouter();
  const [name, setName] = useState(editing?.name ?? '');
  const [opening, setOpening] = useState(editing ? minorToTyped(editing.opening_minor) : '');
  const [color, setColor] = useState(editing?.color ?? accountColors[accountCount % accountColors.length]);
  const [error, setError] = useState('');

  async function save() {
    if (name.trim() === '') return setError('Enter a name.');
    if (!/^\d*\.?\d*$/.test(opening.trim())) return setError('Enter the starting balance as a number.');
    const account = { name: name.trim(), opening_minor: parseAmount(opening.trim()), color };
    try {
      if (editing) await updateAccount(editing.id, account);
      else await addAccount(account);
      router.back();
    } catch {
      setError('Could not save. Try again.');
    }
  }

  function confirmDelete() {
    if (!editing) return;
    if (accountCount < 2) return setError('Keep at least one account.');
    Alert.alert(`Delete ${editing.name}?`, 'This also deletes all of its transactions. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAccount(editing.id);
            router.back();
          } catch {
            setError('Could not delete. Try again.');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <SheetHeader title={editing ? 'Edit account' : 'New account'} onClose={() => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.flex} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.preview}>
            <View style={[styles.initial, { backgroundColor: color }]}>
              <Text style={styles.initialText}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
            </View>
          </View>
          <Field label="Account name" value={name} onChangeText={setName} placeholder="e.g. Bank" maxLength={32} />
          <Field
            label="Starting balance"
            value={opening}
            onChangeText={setOpening}
            placeholder="0"
            keyboardType={currentDecimals() === 0 ? 'number-pad' : 'decimal-pad'}
          />
          <Text style={styles.label}>Colour</Text>
          <ColorSwatches colors={accountColors} selected={color} onSelect={setColor} />
          {error !== '' && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
        <View style={styles.footer}>
          <Button title={editing ? 'Save changes' : 'Add account'} onPress={save} background={sheet.btnBg} color={sheet.btnFg} />
          {editing && (
            <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.delete}>
              <Trash2 color={sheet.neg} size={18} />
              <Text style={styles.deleteText}>Delete account</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sheet.bg, paddingHorizontal: spacing.xl },
  flex: { flex: 1 },
  content: { paddingBottom: spacing.lg },
  preview: { alignItems: 'center', paddingVertical: 4 },
  initial: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: '#FFFFFF', fontSize: 26, fontWeight: '700' },
  label: { color: sheet.ink2, fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  error: { color: sheet.neg, fontSize: 14.5, fontWeight: '600', marginTop: 14, textAlign: 'center' },
  footer: { gap: 10, paddingTop: 6, paddingBottom: spacing.lg },
  delete: { height: 50, borderRadius: 25, backgroundColor: 'rgba(255,107,97,0.16)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteText: { color: sheet.neg, fontSize: 16, fontWeight: '600' },
});
