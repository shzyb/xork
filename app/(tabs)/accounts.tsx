import { useRouter } from 'expo-router';
import { FadeScrollView } from '../../src/components/FadeScrollView';
import { ChevronRight, Plus } from 'lucide-react-native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { ListHeading } from '../../src/components/ListHeading';
import { PressableScale } from '../../src/components/PressableScale';
import { Bone, RowBones } from '../../src/components/Skeleton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountDot } from '../../src/components/AccountButton';
import { ChangeLine } from '../../src/components/ChangeLine';
import { NetWorthChart } from '../../src/components/NetWorthChart';
import { currentMonth, today } from '../../src/dates';
import { getAccountsWithBalance, getNetWorthTrend, getSetting } from '../../src/db';
import { formatMoney } from '../../src/money';
import { fabClearance, fontSize, spacing, useColors } from '../../src/theme';
import { ACCOUNT_TYPES } from '../../src/types';
import { useData } from '../../src/useData';
import { Text } from '../../src/components/Text';

export default function Accounts() {
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const accounts = useData(getAccountsWithBalance);
  const trend = useData(getNetWorthTrend);
  const hidden = useData(() => getSetting('hide_balances')) === '1'; // follows "Keep balances private" in Appearance
  const total = accounts?.reduce((sum, a) => sum + a.balance_minor, 0) ?? 0;
  const mask = (minor: number) => (hidden ? '••••••' : formatMoney(minor));
  // This month so far against the same point last month.
  const elapsed = Number(today().slice(8));
  const change = trend
    ? trend.startMinor + trend.daily.filter((d) => d.day <= elapsed).reduce((n, d) => n + d.total_minor, 0) - trend.prevPointMinor
    : 0;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <FadeScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.ink }]}>Accounts</Text>
        {!accounts || !trend ? (
          <View style={styles.hero}>
            <Bone width={190} height={fontSize.big - 8} radius={14} style={{ alignSelf: 'center' }} />
            <Bone width={140} height={16} style={{ alignSelf: 'center', marginTop: 8 }} />
            <Bone width="100%" height={158} radius={14} style={{ marginTop: spacing.xl }} />
          </View>
        ) : (
          <View style={styles.hero}>
            <Text style={[styles.big, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>{mask(total)}</Text>
            <View style={styles.change}>
              {change !== 0 && <ChangeLine up={change > 0} good={change > 0}>{`${mask(Math.abs(change))} vs last month`}</ChangeLine>}
            </View>
            <NetWorthChart trend={trend} month={currentMonth()} elapsed={elapsed} width={width - spacing.xl * 2} height={120} hidden={hidden} />
          </View>
        )}
        <ListHeading>Your accounts</ListHeading>
        {!accounts ? <RowBones count={4} /> : (
          <>
            {accounts.map((a) => (
              <PressableScale
                key={a.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/account/detail/[id]', params: { id: String(a.id) } })}
                style={styles.row}
              >
                <AccountDot account={a} size={44} />
                <View style={styles.nameBox}>
                  <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>{a.name}</Text>
                  <Text style={{ color: colors.ink3, fontSize: 13, marginTop: 1 }}>
                    {ACCOUNT_TYPES.find((t) => t.value === a.type)?.label}
                  </Text>
                </View>
                <View style={styles.end}>
                  <Text style={[styles.amount, { color: colors.ink }]}>
                    {mask(a.type === 'credit' && a.limit_minor ? Math.max(0, a.limit_minor + a.balance_minor) : a.balance_minor)}
                  </Text>
                  {a.type === 'credit' && a.limit_minor && (
                    <Text style={{ color: colors.ink3, fontSize: 13, marginTop: 1 }}>Owed {mask(-a.balance_minor)}</Text>
                  )}
                </View>
                <ChevronRight color={colors.ink3} size={20} />
              </PressableScale>
            ))}
            <PressableScale
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/account/[id]', params: { id: 'new' } })}
              style={styles.row}
            >
              <View style={[styles.plus, { backgroundColor: colors.fill }]}>
                <Plus color={colors.ink} size={20} />
              </View>
              <Text style={[styles.name, { color: colors.ink }]}>Add an account</Text>
            </PressableScale>
          </>
        )}
      </FadeScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: fabClearance },
  title: { fontSize: fontSize.screen, fontWeight: '800', marginTop: spacing.md },
  hero: { marginTop: spacing.lg },
  big: { fontSize: fontSize.big, fontWeight: '800', letterSpacing: -1.5, textAlign: 'center' },
  change: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 6 },
  plus: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  nameBox: { flex: 1 },
  name: { fontSize: 16.5, fontWeight: '600' },
  end: { alignItems: 'flex-end' },
  amount: { fontSize: 16.5, fontWeight: '600' },
});
