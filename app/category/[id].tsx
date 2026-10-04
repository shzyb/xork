import { useLocalSearchParams, useRouter } from 'expo-router';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { StatusBar } from 'expo-status-bar';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { PressableScale } from '../../src/components/PressableScale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { ColorSwatches } from '../../src/components/ColorSwatches';
import { Field } from '../../src/components/Field';
import { SheetHeader } from '../../src/components/SheetHeader';
import { addCategory, deleteCategory, getCategories, getCategory, updateCategory } from '../../src/db';
import EmojiPicker from 'rn-emoji-keyboard';
import { suggestEmoji } from '../../src/emoji';
import { currentDecimals, minorToTyped, parseAmount } from '../../src/money';
import { categoryColors, sheet, spacing } from '../../src/theme';
import type { Category, CategoryKind } from '../../src/types';
import { useData } from '../../src/useData';
import { Text } from '../../src/components/Text';

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState(editing?.icon ?? ''); // empty until you choose one; then the top suggestion is used
  // A new category starts on the next colour in the list. It shows as a soft tint behind the emoji.
  const [color, setColor] = useState(editing?.color ?? categoryColors[count % categoryColors.length]);
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
          <View style={styles.hero}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Change emoji"
              onPress={() => setPickerOpen(true)}
              style={[styles.emojiCircle, { backgroundColor: `${color}33` }]}
            >
              <Text style={{ fontSize: 40, lineHeight: 52, includeFontPadding: false }}>{emoji}</Text>
            </PressableScale>
            <Text style={styles.heroHint}>Tap to change the emoji</Text>
          </View>
          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder={kind === 'income' ? 'e.g. Bonus' : 'e.g. Pets'}
            maxLength={24}
          />
          {suggestions.length > 0 && (
            <View style={styles.suggestions}>
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
          )}
          {!editing && (
            <>
              <Text style={styles.label}>Type</Text>
              <View style={styles.types}>
                {([['expense', 'Expense'], ['income', 'Income']] as const).map(([key, label]) => (
                  <PressableScale
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: kind === key }}
                    onPress={() => setKind(key)}
                    style={[styles.type, kind === key && styles.typeSelected]}
                  >
                    <Text style={[styles.typeText, kind === key && styles.typeTextSelected]}>{label}</Text>
                  </PressableScale>
                ))}
              </View>
            </>
          )}
          <Text style={styles.label}>Colour</Text>
          <ColorSwatches colors={categoryColors} selected={color} onSelect={setColor} />
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
      <EmojiPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onEmojiSelected={(e) => setPicked(e.emoji)}
        enableSearchBar
        theme={{
          backdrop: sheet.scrim, container: sheet.card, header: sheet.ink2, knob: sheet.ink3,
          search: { background: sheet.card2, text: sheet.ink, placeholder: sheet.ink3, icon: sheet.ink2 },
          category: { icon: sheet.ink3, iconActive: sheet.ink, container: sheet.card2, containerActive: sheet.ink3 },
          emoji: { selected: sheet.card2 },
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sheet.bg, paddingHorizontal: spacing.xl },
  flex: { flex: 1 },
  content: { paddingBottom: spacing.lg },
  label: { color: sheet.ink2, fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  hero: { alignItems: 'center', paddingBottom: 4 },
  emojiCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  heroHint: { color: sheet.ink3, fontSize: 13, marginTop: 8 },
  types: { flexDirection: 'row', gap: 8 },
  type: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: sheet.card, alignItems: 'center', justifyContent: 'center' },
  typeSelected: { backgroundColor: sheet.ink },
  typeText: { color: sheet.ink2, fontSize: 15, fontWeight: '600' },
  typeTextSelected: { color: sheet.bg },
  suggestions: { flexDirection: 'row', gap: 6, marginTop: 10 },
  suggestion: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  suggestionOn: { backgroundColor: sheet.card2 },
  error: { color: sheet.neg, fontSize: 14.5, fontWeight: '600', marginTop: 14, textAlign: 'center' },
  footer: { gap: 10, paddingTop: 6, paddingBottom: spacing.lg },
  delete: { height: 50, borderRadius: 25, backgroundColor: 'rgba(255,107,97,0.16)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteText: { color: sheet.neg, fontSize: 16, fontWeight: '600' },
});
