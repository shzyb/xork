import { useRouter } from 'expo-router';
import { Check, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Sheet } from '../src/components/Sheet';
import { SheetHeader } from '../src/components/SheetHeader';
import { getSetting, setCurrency } from '../src/db';
import { CURRENCIES, currencyOf } from '../src/money';
import { sheet, spacing } from '../src/theme';
import { useData } from '../src/useData';

export default function CurrencyScreen() {
  const currencyCode = useData(() => getSetting('currency'));
  if (currencyCode === undefined) return null;
  return <CurrencyPicker currentCode={currencyCode ?? 'USD'} />;
}

function CurrencyPicker({ currentCode }: { currentCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(currentCode);
  const [error, setError] = useState('');
  const changed = code !== currentCode;
  const next = currencyOf(code);

  async function save() {
    try {
      await setCurrency(code);
      router.back();
    } catch {
      setError('Could not change the currency. Try again.');
    }
  }

  return (
    <Sheet onClose={() => router.back()}>
      <SheetHeader title="Currency" onClose={() => router.back()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.intro}>Everything in the app is shown in one currency.</Text>
        {CURRENCIES.map((c) => (
          <Pressable
            key={c.code}
            accessibilityRole="button"
            accessibilityState={{ selected: c.code === code }}
            onPress={() => { setCode(c.code); setError(''); }}
            style={styles.row}
          >
            <View style={styles.symbol}>
              <Text style={[styles.symbolText, c.symbol.length > 2 && { fontSize: 11 }]}>{c.symbol}</Text>
            </View>
            <View style={styles.main}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.code}>{c.code}</Text>
            </View>
            {c.code === code && <Check color={sheet.pos} size={20} strokeWidth={2.6} />}
          </Pressable>
        ))}
        {changed && (
          <View style={styles.callout}>
            <TriangleAlert color={sheet.ink2} size={18} />
            <Text style={styles.calloutText}>
              Amounts aren't converted: 5,000 {currentCode} becomes 5,000 {next.code}. Only the symbol and formatting change.
            </Text>
          </View>
        )}
        {error !== '' && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          title={changed ? `Switch to ${next.name}` : 'Pick a different currency'}
          onPress={() => changed && save()}
          background={changed ? sheet.btnBg : sheet.card2}
          color={changed ? sheet.btnFg : sheet.ink3}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  content: { paddingBottom: spacing.lg },
  intro: { color: sheet.ink2, fontSize: 15, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  symbol: { width: 44, height: 44, borderRadius: 22, backgroundColor: sheet.card, alignItems: 'center', justifyContent: 'center' },
  symbolText: { color: sheet.ink, fontSize: 16, fontWeight: '700' },
  main: { flex: 1 },
  name: { color: sheet.ink, fontSize: 16.5, fontWeight: '600' },
  code: { color: sheet.ink2, fontSize: 14 },
  callout: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: sheet.card, borderRadius: 16, padding: 14, marginTop: 14 },
  calloutText: { flex: 1, color: sheet.ink2, fontSize: 14.5, fontWeight: '600', lineHeight: 20 },
  error: { color: sheet.neg, fontSize: 14.5, fontWeight: '600', marginTop: 14, textAlign: 'center' },
  footer: { paddingTop: 10, paddingBottom: spacing.lg },
});
