import { useLocalSearchParams, useRouter } from 'expo-router';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { StatusBar } from 'expo-status-bar';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { PressableScale } from '../../src/components/PressableScale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { Field } from '../../src/components/Field';
import { SheetHeader } from '../../src/components/SheetHeader';
import { addCategory, deleteCategory, getCategories, getCategory, updateCategory } from '../../src/db';
import { lastEmoji, suggestEmoji } from '../../src/emoji';
import { currentDecimals, minorToTyped, parseAmount } from '../../src/money';
import { categoryColors, sheet, spacing } from '../../src/theme';
import type { Category, CategoryKind } from '../../src/types';
import { useData } from '../../src/useData';
import { Text, TextInput } from '../../src/components/Text';

// /category/new?kind=income adds a category, /category/5 edits category 5.
export default function CategoryScreen() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const isNew = id === 'new';
  const editing = useData(() => (isNew ? Promise.resolve(null) : getCategory(Number(id))), [id]);

  const count = useData(async () => (await getCategories()).length);

  if (editing === undefined || count === undefined) return null;
  if (!isNew && editing === null) return null;
  return <CategoryForm editing={editing} startKind={kind === 'income' ? 'income' : 'expense'} count={count} />;
}

function CategoryForm({ editing, startKind, count }: { editing: Category | null; startKind: CategoryKind; count: number }) {
  const router = useRouter();
  const [kind, setKind] = useState<CategoryKind>(editing?.kind ?? startKind);
  const [name, setName] = useState(editing?.name ?? '');
  const [picked, setPicked] = useState(editing?.icon ?? ''); // empty until you choose one; then the top suggestion is used
  // A new category takes the next colour in the list. Colours are not edited.
  const color = editing?.color ?? categoryColors[count % categoryColors.length];
  const suggestions = suggestEmoji(name);
  const emoji = picked || suggestions[0] || (kind === 'income' ? '💰' : '🏷️');
  const [budget, setBudget] = useState(editing?.budget_minor ? minorToTyped(editing.budget_minor) : '');
  const [error, setError] = useState('');

  async function save() {
    if (name.trim() === '') return setError('Enter a name.');
    if (!/^\d*\.?\d*$/.test(budget.trim())) return setError('Enter the budget as a number.');
    const budgetMinor = kind === 'expense' ? parseAmount(budget.trim()) || null : null;
    try {
      if (editing) {
        await updateCategory(editing.id, { name: name.trim(), icon: emoji, color, budget_minor: budgetMinor });
      } else {
        await addCategory({ name: name.trim(), kind, icon: emoji, color, budget_minor: budgetMinor });
      }
      router.back();
    } catch {
      setError('Could not save. Try again.');
    }
  }

  function confirmDelete() {
    if (!editing) return;
    Alert.alert(`Delete ${editing.name}?`, 'Its transactions move to Other. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(editing.id);
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
      <SheetHeader title={editing ? 'Edit category' : 'New category'} onClose={() => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FadeScrollView style={styles.flex} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.preview}>
            <CategoryIcon name={emoji} color={color} size={64} />
          </View>
          {!editing && (
            <View style={styles.segment}>
              {([['expense', 'Expense'], ['income', 'Income']] as const).map(([key, label]) => (
                <PressableScale
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: kind === key }}
                  onPress={() => setKind(key)}
                  style={[styles.segmentItem, kind === key && { backgroundColor: sheet.card2 }]}
                >
                  <Text style={[styles.segmentText, kind === key && { color: sheet.ink }]}>{label}</Text>
                </PressableScale>
              ))}
            </View>
          )}
          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder={kind === 'income' ? 'e.g. Bonus' : 'e.g. Pets'}
            maxLength={24}
          />
          <Text style={styles.label}>Emoji</Text>
          <View style={styles.emojiRow}>
            <TextInput
              accessibilityLabel="Emoji. Use your emoji keyboard."
              value={emoji}
              onChangeText={(text) => setPicked(lastEmoji(text) || picked)}
              selectTextOnFocus
              style={styles.emojiInput}
            />
            {suggestions.map((e) => (
              <PressableScale
                key={e}
                accessibilityRole="button"
                accessibilityLabel={`Use ${e}`}
                accessibilityState={{ selected: e === emoji }}
                onPress={() => setPicked(e)}
                style={[styles.suggestion, e === emoji && styles.suggestionOn]}
              >
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </PressableScale>
            ))}
          </View>
          {kind === 'expense' && (
            <Field
              label="Monthly budget (optional)"
              value={budget}
              onChangeText={setBudget}
              placeholder="No budget"
              keyboardType={currentDecimals() === 0 ? 'number-pad' : 'decimal-pad'}
            />
          )}
          {error !== '' && <Text style={styles.error}>{error}</Text>}
        </FadeScrollView>
        <View style={styles.footer}>
          <Button title={editing ? 'Save changes' : 'Create category'} onPress={save} background={sheet.btnBg} color={sheet.btnFg} />
          {editing && !editing.is_default && (
            <PressableScale accessibilityRole="button" onPress={confirmDelete} style={styles.delete}>
              <Trash2 color={sheet.neg} size={18} />
              <Text style={styles.deleteText}>Delete category</Text>
            </PressableScale>
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
  preview: { alignItems: 'center', paddingVertical: 4, paddingBottom: 10 },
  segment: { flexDirection: 'row', backgroundColor: sheet.card, borderRadius: 22, padding: 3, gap: 3 },
  segmentItem: { flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  segmentText: { color: sheet.ink2, fontSize: 14.5, fontWeight: '600' },
  label: { color: sheet.ink2, fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  emojiRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emojiInput: { width: 56, height: 56, borderRadius: 16, backgroundColor: sheet.card, textAlign: 'center', fontSize: 28, color: sheet.ink },
  suggestion: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  suggestionOn: { backgroundColor: sheet.card2 },
  error: { color: sheet.neg, fontSize: 14.5, fontWeight: '600', marginTop: 14, textAlign: 'center' },
  footer: { gap: 10, paddingTop: 6, paddingBottom: spacing.lg },
  delete: { height: 50, borderRadius: 25, backgroundColor: 'rgba(255,107,97,0.16)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteText: { color: sheet.neg, fontSize: 16, fontWeight: '600' },
});
