import { Tabs, useRouter } from 'expo-router';
import { ChartNoAxesColumn, Clock, Plus, Repeat, Wallet } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarHeight, useColors } from '../../src/theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TAB_ORDER = ['index', 'activity', 'recurring', 'insights'];
// `filled` icons become solid shapes when selected; the others are line icons, so they turn black and bold instead.
const TABS: Record<string, { Icon: LucideIcon; label: string; filled: boolean }> = {
  index: { Icon: Wallet, label: 'Home', filled: true },
  activity: { Icon: Clock, label: 'Activity', filled: true },
  recurring: { Icon: Repeat, label: 'Recurring', filled: false },
  insights: { Icon: ChartNoAxesColumn, label: 'Insights', filled: false },
};

// Our own bar: the built-in one lines icons up at the top of each item, and we want them centred.
function TabBar({ state, navigation }: TabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.bg, borderTopColor: colors.line, height: tabBarHeight + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      {TAB_ORDER.map((name) => {
        const index = state.routes.findIndex((r) => r.name === name);
        const route = state.routes[index];
        const tab = TABS[name];
        if (!route) return null;
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={styles.item}
          >
            <tab.Icon
              size={25}
              color={focused ? (tab.filled ? colors.bg : colors.ink) : colors.ink3}
              fill={focused && tab.filled ? colors.ink : 'none'}
              strokeWidth={focused && !tab.filled ? 2.8 : 2}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }} />
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
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
