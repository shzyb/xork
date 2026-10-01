import { StyleSheet, View } from 'react-native';
import { useColors } from '../theme';
import { Text } from './Text';

export function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  const colors = useColors();
  return (
    <View style={[styles.tile, { backgroundColor: colors.fill }]}>
      <Text style={{ color: colors.ink2, fontSize: 13.5, fontWeight: '500' }}>{label}</Text>
      <Text style={[styles.tileValue, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={{ color: colors.ink2, fontSize: 13, marginTop: 3 }} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { width: '48.5%', flexGrow: 1, borderRadius: 22, padding: 16 },
  tileValue: { fontSize: 23, fontWeight: '700', marginTop: 6, letterSpacing: -0.5 },
});
