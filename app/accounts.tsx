import { useRouter } from 'expo-router';
import { FadeScrollView } from '../src/components/FadeScrollView';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Sheet } from '../src/components/Sheet';
import { SheetHeader } from '../src/components/SheetHeader';
import { getAccountsWithBalance } from '../src/db';
import { today } from '../src/dates';
import { creditStatus, dueText } from '../src/insights';
import { formatMoney } from '../src/money';
import { sheet, spacing } from '../src/theme';
import { ACCOUNT_TYPES } from '../src/types';
import { useData } from '../src/useData';
import { Text } from '../src/components/Text';

export default function Accounts() {
  const router = useRouter();
  const accounts = useData(getAccountsWithBalance);
  const total = accounts?.reduce((sum, a) => sum + a.balance_minor, 0) ?? 0;

  return (
    <Sheet onClose={() => router.back()}>
      <SheetHeader title="Accounts" onClose={() => router.back()} />
      <FadeScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {accounts && (
          <>
            <Text style={styles.intro}>
              {accounts.length} account{accounts.length === 1 ? '' : 's'} · {formatMoney(total)} in total
            </Text>
            {accounts.map((a) => {
              const credit = a.type === 'credit' && a.limit_minor ? creditStatus(-a.balance_minor, a.limit_minor) : null;
              const tint = credit?.state === 'warn' ? sheet.warn : credit && credit.state !== 'ok' ? sheet.neg : sheet.ink;
              return (
                <View key={a.id}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/account/[id]', params: { id: String(a.id) } })}
                    style={styles.row}
                  >
                    <View style={[styles.initial, { backgroundColor: a.color }]}>
                      <Text style={styles.initialText}>{a.name.trim().charAt(0).toUpperCase() || '?'}</Text>
                    </View>
                    <View style={styles.nameBox}>
                      <Text style={styles.name} numberOfLines={1}>{a.name}</Text>
                      <Text style={styles.type}>{ACCOUNT_TYPES.find((t) => t.value === a.type)?.label}</Text>
                    </View>
                    <Text style={styles.amount}>{formatMoney(a.balance_minor)}</Text>
                    <ChevronRight color={sheet.ink3} size={20} />
                  </Pressable>
                  {credit && a.limit_minor && (
                    <View style={styles.credit}>
                      <View style={styles.meter}>
                        <View style={{ width: `${Math.min(100, credit.percent)}%`, height: '100%', borderRadius: 3, backgroundColor: tint }} />
                      </View>
                      <Text style={[styles.creditText, credit.state !== 'ok' && { color: tint }]}>
                        {credit.state === 'full' ? 'At the limit' : `${formatMoney(credit.left)} left of ${formatMoney(a.limit_minor)}`}
                        {a.due_day ? ` · ${dueText(a.due_day, today())}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
      </FadeScrollView>
      <View style={styles.footer}>
        <Button
          title="Add an account"
          onPress={() => router.push({ pathname: '/account/[id]', params: { id: 'new' } })}
          background={sheet.btnBg}
          color={sheet.btnFg}
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
  initial: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  nameBox: { flex: 1 },
  name: { color: sheet.ink, fontSize: 16.5, fontWeight: '600' },
  type: { color: sheet.ink3, fontSize: 13, marginTop: 1 },
  credit: { marginLeft: 58, marginBottom: 8 },
  meter: { height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: sheet.card2 },
  creditText: { color: sheet.ink2, fontSize: 12.5, marginTop: 4 },
  amount: { color: sheet.ink, fontSize: 16.5, fontWeight: '600' },
  footer: { paddingTop: 10, paddingBottom: spacing.lg },
});
