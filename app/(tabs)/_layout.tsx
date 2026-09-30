import { Tabs, useRouter } from 'expo-router';
import { ChartNoAxesColumn, Clock, Plus, Repeat, Wallet } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarHeight, useColors } from '../../src/theme';

function TabIcon({ Icon, focused }: { Icon: LucideIcon; focused: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.icon, focused && { backgroundColor: colors.ink }]}>
      <Icon color={focused ? colors.bg : colors.ink3} size={22} />
    </View>
  );
}

export default function TabsLayout() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: colors.bg,
            borderTopColor: colors.line,
            height: tabBarHeight + insets.bottom,
            paddingBottom: insets.bottom,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ tabBarAccessibilityLabel: 'Home', tabBarIcon: ({ focused }) => <TabIcon Icon={Wallet} focused={focused} /> }} />
        <Tabs.Screen name="activity" options={{ tabBarAccessibilityLabel: 'Activity', tabBarIcon: ({ focused }) => <TabIcon Icon={Clock} focused={focused} /> }} />
        <Tabs.Screen name="recurring" options={{ tabBarAccessibilityLabel: 'Recurring', tabBarIcon: ({ focused }) => <TabIcon Icon={Repeat} focused={focused} /> }} />
        <Tabs.Screen name="insights" options={{ tabBarAccessibilityLabel: 'Insights', tabBarIcon: ({ focused }) => <TabIcon Icon={ChartNoAxesColumn} focused={focused} /> }} />
      </Tabs>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add"
        onPress={() => router.push('/add-menu')}
        style={[styles.fab, { backgroundColor: colors.btnBg, bottom: tabBarHeight + insets.bottom + 16 }]}
      >
        <Plus color={colors.btnFg} size={28} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  icon: { width: 44, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
});
