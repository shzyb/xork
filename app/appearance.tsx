import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
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

const LIGHT = { bg: '#F7F7F8', block: '#E4E4E8', dot: '#C7C7CC', button: '#0A0A0A' };
const DARK = { bg: '#1C1C1E', block: '#3A3A3C', dot: '#58585C', button: '#F5F5F7' };

// A tiny drawing of a screen: a heading block, a row of dots and a button.
function Mini({ p }: { p: typeof LIGHT }) {
  return (
    <View style={[styles.mini, { backgroundColor: p.bg }]}>
      <View style={[styles.block, { backgroundColor: p.block }]} />
      <View style={styles.dots}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.dot, { backgroundColor: p.dot }]} />
        ))}
      </View>
      <View style={[styles.button, { backgroundColor: p.button }]} />
    </View>
  );
}

// System is the light drawing with the right half replaced by the dark one.
function Preview({ mode }: { mode: ThemeSetting }) {
  const [width, setWidth] = useState(0);
  if (mode !== 'system') return <Mini p={mode === 'dark' ? DARK : LIGHT} />;
  return (
    <View style={styles.flex} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Mini p={LIGHT} />
      <View style={styles.rightHalf}>
        <View style={{ width, height: '100%', marginLeft: -width / 2 }}>
          <Mini p={DARK} />
        </View>
      </View>
    </View>
  );
}

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
      <Text style={{ color: colors.ink2, fontSize: 15, marginTop: 4, marginBottom: spacing.lg }}>Theme</Text>
      <View style={styles.options}>
        {THEME_OPTIONS.map((o) => {
          const selected = theme === o.value;
          return (
            <PressableScale
              key={o.value}
              accessibilityRole="button"
              accessibilityLabel={`${o.label} theme`}
              accessibilityState={{ selected }}
              onPress={() => choose(o.value)}
              style={styles.option}
            >
              <View style={[styles.ring, { borderColor: selected ? colors.ink : 'transparent' }]}>
                <View style={[styles.frame, { borderColor: colors.fill2 }]}>
                  <Preview mode={o.value} />
                </View>
              </View>
              <Text style={[styles.label, { color: selected ? colors.ink : colors.ink2, fontWeight: selected ? '700' : '500' }]}>
                {o.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      {error !== '' && <Text style={[styles.error, { color: colors.neg }]}>{error}</Text>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  flex: { flex: 1 },
  back: { width: 44, height: 44, marginLeft: -10, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize.screen, fontWeight: '800' },
  options: { flexDirection: 'row', gap: 12 },
  option: { flex: 1, alignItems: 'center', gap: 8 },
  ring: { width: '100%', aspectRatio: 0.74, borderWidth: 2, borderRadius: 18, padding: 3 },
  frame: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  mini: { flex: 1, padding: 10, gap: 8 },
  block: { height: '26%', borderRadius: 8 },
  dots: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  button: { marginTop: 'auto', height: 14, borderRadius: 7 },
  rightHalf: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '50%', overflow: 'hidden' },
  label: { fontSize: 14.5 },
  error: { fontSize: 14.5, fontWeight: '600', marginTop: 14 },
});
