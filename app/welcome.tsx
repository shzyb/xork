import { getLocales } from 'expo-localization';
import { FadeScrollView } from '../src/components/FadeScrollView';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '../src/components/PressableScale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { completeWelcome } from '../src/db';
import { CURRENCIES, guessCurrency } from '../src/money';
import { fontSize, spacing, useColors } from '../src/theme';
import { Text } from '../src/components/Text';

export default function Welcome() {
  const colors = useColors();
  const [selected, setSelected] = useState(() => guessCurrency(getLocales()[0] ?? {}));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.ink }]}>Which currency do you use?</Text>
      <FadeScrollView style={styles.list} contentContainerStyle={styles.pills}>
        {CURRENCIES.map((currency) => {
          const on = currency.code === selected;
          return (
            <PressableScale
              key={currency.code}
              accessibilityRole="button"
              accessibilityLabel={currency.name}
              accessibilityState={{ selected: on }}
              onPress={() => setSelected(currency.code)}
              style={[styles.pill, { backgroundColor: on ? colors.btnBg : colors.fill }]}
            >
              <Text style={[styles.pillText, { color: on ? colors.btnFg : colors.ink }]}>
                {currency.symbol} {currency.code}
              </Text>
            </PressableScale>
          );
        })}
      </FadeScrollView>
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
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.md },
  pill: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: fontSize.body, fontWeight: '600' },
  footer: { marginTop: spacing.md },
});
