import { useRouter } from 'expo-router';
import { ArrowDown, ArrowLeftRight, ArrowUp, Repeat } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Sheet } from '../src/components/Sheet';
import { sheet } from '../src/theme';
import { Text } from '../src/components/Text';

// What the + button opens: a floating black tray to choose what to log. Each row replaces the tray with its form.
export default function AddMenu() {
  const router = useRouter();

  return (
    <Sheet onClose={() => router.back()}>
      <View style={styles.list}>
        <Row
          Icon={ArrowUp}
          title="Expense"
          subtitle="Money you spent"
          onPress={() => router.replace({ pathname: '/add', params: { type: 'expense' } })}
        />
        <Row
          Icon={ArrowDown}
          title="Income"
          subtitle="Money that came in"
          onPress={() => router.replace({ pathname: '/add', params: { type: 'income' } })}
        />
        <Row
          Icon={ArrowLeftRight}
          title="Move money"
          subtitle="Between your own accounts"
          onPress={() => router.replace({ pathname: '/add', params: { type: 'transfer' } })}
        />
        <Row
          Icon={Repeat}
          title="Recurring item"
          subtitle="Rent, bills, subscriptions, salary"
          onPress={() => router.replace({ pathname: '/recurring/[id]', params: { id: 'new' } })}
        />
      </View>
    </Sheet>
  );
}

function Row({ Icon, title, subtitle, onPress }: { Icon: LucideIcon; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <View style={styles.icon}>
        <Icon color={sheet.ink} size={20} strokeWidth={2.2} />
      </View>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 68, paddingVertical: 4 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: sheet.card2, alignItems: 'center', justifyContent: 'center' },
  title: { color: sheet.ink, fontSize: 17, fontWeight: '600' },
  subtitle: { color: sheet.ink2, fontSize: 14 },
});
