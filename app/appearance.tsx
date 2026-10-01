import { useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PressableScale } from '../src/components/PressableScale';
import { Text } from '../src/components/Text';
import { getSetting, setTheme } from '../src/db';
import { fontSize, spacing, useColors } from '../src/theme';
import { THEME_OPTIONS } from '../src/types';
import type { ThemeSetting } from '../src/types';
import { useData } from '../src/useData';

const DESCRIPTIONS: Record<ThemeSetting, string> = {
  system: "Match your phone's setting",
  light: 'A white background',
  dark: 'A dark background',
};

export default function Appearance() {
  const colors = useColors();
  const router = useRouter();
  const saved = useData(() => getSetting('theme'));
  const [error, setError] = useState('');
  const theme: ThemeSetting = saved === 'light' || saved === 'dark' ? saved : 'system';

  async function choose(next: ThemeSetting) {
    setError('');
    try {
      await setTheme(next);
    } catch {
      setError('Could not save. Try again.');
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <PressableScale accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <ChevronLeft color={colors.ink} size={26} />
      </PressableScale>
      <Text style={[styles.title, { color: colors.ink }]}>Appearance</Text>
      <Text style={{ color: colors.ink2, fontSize: 15, marginTop: 4, marginBottom: spacing.md }}>Theme</Text>
      {THEME_OPTIONS.map((o) => (
        <PressableScale
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: theme === o.value }}
          onPress={() => choose(o.value)}
          style={styles.row}
        >
          <View style={styles.main}>
            <Text style={[styles.name, { color: colors.ink }]}>{o.label}</Text>
            <Text style={{ color: colors.ink2, fontSize: 13.5 }}>{DESCRIPTIONS[o.value]}</Text>
          </View>
          {theme === o.value && <Check color={colors.ink} size={22} strokeWidth={2.4} />}
        </PressableScale>
      ))}
      {error !== '' && <Text style={[styles.error, { color: colors.neg }]}>{error}</Text>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  back: { width: 44, height: 44, marginLeft: -10, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize.screen, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 6 },
  main: { flex: 1 },
  name: { fontSize: 16.5, fontWeight: '600' },
  error: { fontSize: 14.5, fontWeight: '600', marginTop: 14 },
});
