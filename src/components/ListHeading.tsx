import { StyleSheet } from 'react-native';
import { useColors } from '../theme';
import { Text } from './Text';

// The title above a group of rows, e.g. a date in a transaction list or "Income" in the recurring list.
export function ListHeading({ children }: { children: string }) {
  const colors = useColors();
  return <Text style={[styles.heading, { color: colors.ink }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  heading: { fontSize: 17, fontWeight: '700', paddingTop: 22, paddingBottom: 4 },
});
