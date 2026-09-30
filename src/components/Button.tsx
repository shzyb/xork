import { Pressable, StyleSheet, Text } from 'react-native';

export function Button({ title, onPress, background, color }: {
  title: string;
  onPress: () => void;
  background: string;
  color: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, { backgroundColor: background }]}>
      <Text style={[styles.text, { color }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 17, fontWeight: '600' },
});
