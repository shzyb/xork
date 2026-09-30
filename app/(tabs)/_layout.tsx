import { Tabs, useRouter } from 'expo-router';
import { ChartPie, Clock, Plus, Repeat } from 'lucide-react-native';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { tabBarHeight, useColors } from '../../src/theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
type Colors = { focused: boolean; ink: string; bg: string; grey: string };

const SIZE = 25;
const TAB_ORDER = ['index', 'activity', 'recurring', 'insights'];

// Selected icons are filled black. Home, Clock and Pie are drawn here so their outer outline stays solid and only
// inner details (the clock hands) are cut out in the background colour, so they don't look smaller.
// The house without its door: solid when selected, an outline otherwise.
function HomeIcon({ color, filled }: { color: string; filled: boolean }) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
      <G strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path
          d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
          fill={filled ? color : 'none'}
          stroke={color}
        />
      </G>
    </Svg>
  );
}

function FilledClock({ ink, bg }: { ink: string; bg: string }) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
      <G strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={12} cy={12} r={10} fill={ink} stroke={ink} />
        <Path d="M12 6v6l4 2" fill="none" stroke={bg} />
      </G>
    </Svg>
  );
}

// The big arc stays an outline; only the detached right-hand slice is solid.
function FilledPie({ ink }: { ink: string }) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
      <G strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M21.21 15.89A10 10 0 1 1 8 2.83" fill="none" stroke={ink} />
        <Path
          d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"
          fill={ink}
          stroke={ink}
        />
      </G>
    </Svg>
  );
}

const TABS: Record<string, { label: string; icon: (c: Colors) => ReactNode }> = {
  index: { label: 'Home', icon: (c) => <HomeIcon color={c.focused ? c.ink : c.grey} filled={c.focused} /> },
  activity: { label: 'Activity', icon: (c) => (c.focused ? <FilledClock ink={c.ink} bg={c.bg} /> : <Clock size={SIZE} color={c.grey} strokeWidth={2} />) },
  // Line icons have nothing to fill, so selected they turn black and bold.
  recurring: { label: 'Recurring', icon: (c) => <Repeat size={SIZE} color={c.focused ? c.ink : c.grey} strokeWidth={c.focused ? 2.8 : 2} /> },
  insights: { label: 'Insights', icon: (c) => (c.focused ? <FilledPie ink={c.ink} /> : <ChartPie size={SIZE} color={c.grey} strokeWidth={2} />) },
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
            {tab.icon({ focused, ink: colors.ink, bg: colors.bg, grey: colors.ink3 })}
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
