import { Tabs, useRouter } from 'expo-router';
import { Plus, Wallet } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../src/theme';

const BAR_HEIGHT = 56;

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
            height: BAR_HEIGHT + insets.bottom,
            paddingBottom: insets.bottom,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarAccessibilityLabel: 'Home',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.icon, focused && { backgroundColor: colors.ink }]}>
                <Wallet color={focused ? colors.bg : colors.ink3} size={22} />
              </View>
            ),
          }}
        />
      </Tabs>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add"
        onPress={() => router.push('/add')}
        style={[styles.fab, { backgroundColor: colors.btnBg, bottom: BAR_HEIGHT + insets.bottom + 16 }]}
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
