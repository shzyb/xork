import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { sheet } from '../theme';

// A label above a text input, for the black sheet.
export function Field({ label, value, onChangeText, placeholder, maxLength, keyboardType }: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  maxLength?: number;
  keyboardType?: TextInputProps['keyboardType'];
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={sheet.ink3}
        maxLength={maxLength}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: sheet.ink2, fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  input: { height: 50, borderRadius: 16, backgroundColor: sheet.card, paddingHorizontal: 14, color: sheet.ink, fontSize: 16 },
});
