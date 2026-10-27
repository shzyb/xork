import { useRouter } from 'expo-router';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { Eye, EyeOff, Receipt, Settings } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '../../src/components/PressableScale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/components/EmptyState';
import { HomeHero } from '../../src/components/HomeHero';
import { RowBones } from '../../src/components/Skeleton';
import { TransactionList } from '../../src/components/TransactionList';
import { getSetting, getSpendTrend, getTransactions, NO_FILTER } from '../../src/db';
import { fabClearance, fontSize, spacing, useColors } from '../../src/theme';
import { useData } from '../../src/useData';
import { Text } from '../../src/components/Text';

export default function Home() {
  const colors = useColors();
  const router = useRouter();
  const openingSettings = useRef(false);
  const hideOnOpen = useData(() => getSetting('hide_balances'));
  const [shown, setShown] = useState<boolean | null>(null);
  const hidden = shown === null ? hideOnOpen === '1' : !shown;
  // Changing "Hide balances on open" in Appearance takes over from the eye button.
  useEffect(() => setShown(null), [hideOnOpen]);
  // A quick double tap would otherwise push Settings twice.
  function openSettings() {
    if (openingSettings.current) return;
    openingSettings.current = true;
    setTimeout(() => { openingSettings.current = false; }, 700);
    router.push('/settings');
  }
  const recent = useData(() => getTransactions(NO_FILTER, 8));
  const spend = useData(getSpendTrend);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <FadeScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Text style={[styles.brand, { color: colors.ink }]}>Home</Text>
          <View style={styles.actions}>
            <PressableScale accessibilityRole="button" accessibilityLabel={hidden ? 'Show balances' : 'Hide balances'} onPress={() => setShown(hidden)} style={styles.iconButton}>
              {hidden ? <EyeOff color={colors.ink} size={22} /> : <Eye color={colors.ink} size={22} />}
            </PressableScale>
            <PressableScale accessibilityRole="button" accessibilityLabel="Settings" onPress={openSettings} style={styles.iconButton}>
              <Settings color={colors.ink} size={22} />
            </PressableScale>
          </View>
        </View>

        <HomeHero spend={hideOnOpen === undefined ? undefined : spend} hidden={hidden} />

        {recent === undefined ? <RowBones count={6} /> : (recent.length === 0 ? (
          <EmptyState Icon={Receipt} title="No transactions yet" text="Tap + to log your first expense or income." />
        ) : (
          <>
            <TransactionList rows={recent} />
            <PressableScale accessibilityRole="button" onPress={() => router.navigate('/activity')} style={[styles.seeAll, { backgroundColor: colors.fill }]}>
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>See all transactions</Text>
            </PressableScale>
          </>
        ))}
      </FadeScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: fabClearance },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  brand: { fontSize: fontSize.screen, fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  seeAll: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 20, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm },
});
