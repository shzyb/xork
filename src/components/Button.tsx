import { StyleSheet } from 'react-native';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export function Button({ title, onPress, background, color }: {
  title: string;
  onPress: () => void;
  background: string;
  color: string;
}) {
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} style={[styles.button, { backgroundColor: background }]}>
      <Text style={[styles.text, { color }]}>{title}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 17, fontWeight: '600' },
});
