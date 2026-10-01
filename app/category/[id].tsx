import { useLocalSearchParams, useRouter } from 'expo-router';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { StatusBar } from 'expo-status-bar';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { PressableScale } from '../../src/components/PressableScale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { CATEGORY_ICONS, CategoryIcon } from '../../src/components/CategoryIcon';
import { ColorSwatches } from '../../src/components/ColorSwatches';
import { Field } from '../../src/components/Field';
import { SheetHeader } from '../../src/components/SheetHeader';
import { addCategory, deleteCategory, getCategory, updateCategory } from '../../src/db';
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

  if (editing === undefined) return null;
  if (!isNew && editing === null) return null;
  return <CategoryForm editing={editing} startKind={kind === 'income' ? 'income' : 'expense'} />;
}

function CategoryForm({ editing, startKind }: { editing: Category | null; startKind: CategoryKind }) {
  const router = useRouter();
  const [kind, setKind] = useState<CategoryKind>(editing?.kind ?? startKind);
  const [name, setName] = useState(editing?.name ?? '');
  const [icon, setIcon] = useState(editing?.icon ?? (startKind === 'income' ? 'briefcase' : 'tag'));
  const [color, setColor] = useState(editing?.color ?? categoryColors[0]);
  const [budget, setBudget] = useState(editing?.budget_minor ? minorToTyped(editing.budget_minor) : '');
  const [error, setError] = useState('');

  async function save() {
    if (name.trim() === '') return setError('Enter a name.');
    if (!/^\d*\.?\d*$/.test(budget.trim())) return setError('Enter the budget as a number.');
    const budgetMinor = kind === 'expense' ? parseAmount(budget.trim()) || null : null;
    try {
      if (editing) {
        await updateCategory(editing.id, { name: name.trim(), icon, color, budget_minor: budgetMinor });
      } else {
        await addCategory({ name: name.trim(), kind, icon, color, budget_minor: budgetMinor });
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
            <CategoryIcon name={icon} color={color} size={64} />
          </View>
          {!editing && (
            <View style={styles.segment}>
              {([['expense', 'Spending'], ['income', 'Income']] as const).map(([key, label]) => (
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
          <Text style={styles.label}>Icon</Text>
          <View style={styles.icons}>
            {CATEGORY_ICONS.map((iconName) => (
              <PressableScale
                key={iconName}
                accessibilityRole="button"
                accessibilityLabel={iconName}
                accessibilityState={{ selected: iconName === icon }}
                onPress={() => setIcon(iconName)}
                style={styles.iconCell}
              >
                <View style={iconName === icon && styles.iconSelected}>
                  <CategoryIcon name={iconName} color={iconName === icon ? color : sheet.card2} size={44} />
                </View>
              </PressableScale>
            ))}
          </View>
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
  icons: { flexDirection: 'row', flexWrap: 'wrap' },
  iconCell: { width: '16.666%', alignItems: 'center', paddingVertical: 6 },
  iconSelected: { padding: 3, borderRadius: 28, borderWidth: 2, borderColor: sheet.ink, margin: -5 },
  error: { color: sheet.neg, fontSize: 14.5, fontWeight: '600', marginTop: 14, textAlign: 'center' },
  footer: { gap: 10, paddingTop: 6, paddingBottom: spacing.lg },
  delete: { height: 50, borderRadius: 25, backgroundColor: 'rgba(255,107,97,0.16)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteText: { color: sheet.neg, fontSize: 16, fontWeight: '600' },
});
