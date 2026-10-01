import { useRouter } from 'expo-router';
import { FadeScrollView } from '../src/components/FadeScrollView';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '../src/components/PressableScale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { getAccountsWithBalance } from '../src/db';
import { formatMoney } from '../src/money';
import { fontSize, spacing, useColors } from '../src/theme';
import { ACCOUNT_TYPES } from '../src/types';
import { useData } from '../src/useData';
import { Text } from '../src/components/Text';

export default function Accounts() {
  const colors = useColors();
  const router = useRouter();
  const accounts = useData(getAccountsWithBalance);
  const total = accounts?.reduce((sum, a) => sum + a.balance_minor, 0) ?? 0;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <PressableScale accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <ChevronLeft color={colors.ink} size={26} />
      </PressableScale>
      <FadeScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.ink }]}>Accounts</Text>
        {accounts && (
          <>
            <Text style={{ color: colors.ink2, fontSize: 15, marginTop: 4, marginBottom: spacing.md }}>
              {accounts.length} account{accounts.length === 1 ? '' : 's'} · {formatMoney(total)} in total
            </Text>
            {accounts.map((a) => (
              <PressableScale
                key={a.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/account/detail/[id]', params: { id: String(a.id) } })}
                style={styles.row}
              >
                <View style={[styles.initial, { backgroundColor: a.color }]}>
                  <Text style={styles.initialText}>{a.name.trim().charAt(0).toUpperCase() || '?'}</Text>
                </View>
                <View style={styles.nameBox}>
                  <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>{a.name}</Text>
                  <Text style={{ color: colors.ink3, fontSize: 13, marginTop: 1 }}>
                    {ACCOUNT_TYPES.find((t) => t.value === a.type)?.label}
                  </Text>
                </View>
                <View style={styles.end}>
                  <Text style={[styles.amount, { color: colors.ink }]}>
                    {formatMoney(a.type === 'credit' && a.limit_minor ? Math.max(0, a.limit_minor + a.balance_minor) : a.balance_minor)}
                  </Text>
                  {a.type === 'credit' && a.limit_minor && (
                    <Text style={{ color: colors.ink3, fontSize: 13, marginTop: 1 }}>Owed {formatMoney(-a.balance_minor)}</Text>
                  )}
                </View>
                <ChevronRight color={colors.ink3} size={20} />
              </PressableScale>
            ))}
          </>
        )}
      </FadeScrollView>
      <View style={styles.footer}>
        <Button
          title="Add an account"
          onPress={() => router.push({ pathname: '/account/[id]', params: { id: 'new' } })}
          background={colors.btnBg}
          color={colors.btnFg}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  flex: { flex: 1 },
  back: { width: 44, height: 44, marginLeft: -10, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: spacing.lg },
  title: { fontSize: fontSize.screen, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 6 },
  initial: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  nameBox: { flex: 1 },
  name: { fontSize: 16.5, fontWeight: '600' },
  end: { alignItems: 'flex-end' },
  amount: { fontSize: 16.5, fontWeight: '600' },
  footer: { paddingTop: 10, paddingBottom: spacing.lg },
});
