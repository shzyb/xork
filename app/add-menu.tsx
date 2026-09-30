import { useRouter } from 'expo-router';
import { ArrowDown, ArrowLeftRight, ArrowUp, Repeat } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sheet, spacing } from '../src/theme';

// What the + button opens: a floating black tray to choose what to log. Each row replaces the tray with its form.
// The dimmed background fades in (screen animation); only the tray slides up.
export default function AddMenu() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(320)).current;

  useEffect(() => {
    Animated.timing(slide, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [slide]);

  return (
    <View style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.tray, { marginBottom: 8 + insets.bottom, transform: [{ translateY: slide }] }]}>
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
      </Animated.View>
    </View>
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
  root: { flex: 1, justifyContent: 'flex-end' },
  tray: { backgroundColor: sheet.bg, borderRadius: 34, marginHorizontal: 8, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 68, paddingVertical: 4 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: sheet.card2, alignItems: 'center', justifyContent: 'center' },
  title: { color: sheet.ink, fontSize: 17, fontWeight: '600' },
  subtitle: { color: sheet.ink2, fontSize: 14 },
});
