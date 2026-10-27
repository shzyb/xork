import { StyleSheet, View } from 'react-native';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import { useColors } from '../theme';

// A grey block standing in for something that is still loading, so the screen has its shape before the data arrives.
export function Bone({ width, height, radius = 8, style }: {
  width: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return <View style={[{ width, height, borderRadius: radius, backgroundColor: colors.fill }, style]} />;
}

// Rows shaped like a transaction or an account: a round icon, two lines of text and an amount.
export function RowBones({ count }: { count: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.row}>
          <Bone width={44} height={44} radius={22} />
          <View style={styles.main}>
            <Bone width="55%" height={15} />
            <Bone width="35%" height={12} />
          </View>
          <Bone width={64} height={15} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  main: { flex: 1, gap: 8 },
});
