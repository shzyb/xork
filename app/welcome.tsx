import { getLocales } from 'expo-localization';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { Button } from '../src/components/Button';
import { completeWelcome } from '../src/db';
import { CURRENCIES, guessCurrency } from '../src/money';
import { fontSize, spacing, useColors } from '../src/theme';

export default function Welcome() {
  const colors = useColors();
  const [selected, setSelected] = useState(() => guessCurrency(getLocales()[0] ?? {}));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.ink }]}>Which currency do you use?</Text>
      <ScrollView style={styles.list}>
        {CURRENCIES.map((currency) => {
          const on = currency.code === selected;
          return (
            <Pressable
              key={currency.code}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => setSelected(currency.code)}
              style={[styles.row, { backgroundColor: on ? colors.fill : colors.bg }]}
            >
              <Text style={[styles.symbol, { color: colors.ink }]}>{currency.symbol}</Text>
              <View style={styles.names}>
                <Text style={[styles.code, { color: colors.ink }]}>{currency.code}</Text>
                <Text style={{ color: colors.ink2, fontSize: fontSize.small }}>{currency.name}</Text>
              </View>
              {on && <Check color={colors.ink} size={22} />}
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Continue" background={colors.btnBg} color={colors.btnFg} onPress={() => completeWelcome(selected)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  title: { fontSize: fontSize.screen, fontWeight: '800', marginTop: spacing.xxl, marginBottom: spacing.lg },
  list: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderRadius: 16, paddingHorizontal: spacing.md, gap: spacing.md },
  symbol: { width: 48, fontSize: fontSize.title, fontWeight: '700', textAlign: 'center' },
  names: { flex: 1 },
  code: { fontSize: fontSize.body, fontWeight: '600' },
  footer: { marginTop: spacing.md },
});
