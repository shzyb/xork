import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useColors } from '../theme';
import { Text } from './Text';

// An arrow and a short comparison, e.g. "Rs 4,200 vs last month". The arrow points the way it moved; green or red says
// whether that is good news, so spending going up can be red while savings going up is green.
export function ChangeLine({ up, good, children }: { up: boolean; good: boolean; children: string }) {
  const colors = useColors();
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <View style={styles.line}>
      <Arrow color={good ? colors.pos : colors.neg} size={16} strokeWidth={2.4} />
      <Text style={[styles.text, { color: colors.ink2 }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  text: { opacity: 0.8, fontSize: 15, fontWeight: '600', flexShrink: 1 },
});
