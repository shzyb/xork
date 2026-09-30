import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronRight } from 'lucide-react-native';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { SheetHeader } from '../src/components/SheetHeader';
import { getAccountsWithBalance } from '../src/db';
import { formatMoney } from '../src/money';
import { sheet, spacing } from '../src/theme';
import { useData } from '../src/useData';

export default function Accounts() {
  const router = useRouter();
  const accounts = useData(getAccountsWithBalance);
  const total = accounts?.reduce((sum, a) => sum + a.balance_minor, 0) ?? 0;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <SheetHeader title="Accounts" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        {accounts && (
          <>
            <Text style={styles.intro}>
              {accounts.length} account{accounts.length === 1 ? '' : 's'} · {formatMoney(total)} in total
            </Text>
            {accounts.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/account/[id]', params: { id: String(a.id) } })}
                style={styles.row}
              >
                <View style={[styles.initial, { backgroundColor: a.color }]}>
                  <Text style={styles.initialText}>{a.name.trim().charAt(0).toUpperCase() || '?'}</Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>{a.name}</Text>
                <Text style={styles.amount}>{formatMoney(a.balance_minor)}</Text>
                <ChevronRight color={sheet.ink3} size={20} />
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          title="Add an account"
          onPress={() => router.push({ pathname: '/account/[id]', params: { id: 'new' } })}
          background={sheet.btnBg}
          color={sheet.btnFg}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sheet.bg, paddingHorizontal: spacing.xl },
  content: { paddingBottom: spacing.lg },
  intro: { color: sheet.ink2, fontSize: 15, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  initial: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  name: { flex: 1, color: sheet.ink, fontSize: 16.5, fontWeight: '600' },
  amount: { color: sheet.ink, fontSize: 16.5, fontWeight: '600' },
  footer: { paddingTop: 10, paddingBottom: spacing.lg },
});
