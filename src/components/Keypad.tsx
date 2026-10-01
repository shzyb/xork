import { Delete } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { sheet } from '../theme';
import { Text } from './Text';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

// Plain-digit keypad for the black sheet. The "." key is left blank when the currency has no decimals.
export function Keypad({ onKey, decimals }: { onKey: (key: string) => void; decimals: number }) {
  return (
    <View style={styles.keypad}>
      {KEYS.map((key) =>
        key === '.' && decimals === 0 ? (
          <View key={key} style={styles.key} />
        ) : (
          <PressableScale
            key={key}
            accessibilityRole="button"
            accessibilityLabel={key === 'back' ? 'Delete' : key}
            onPress={() => onKey(key)}
            style={styles.key}
          >
            {key === 'back' ? <Delete color={sheet.ink} size={26} /> : <Text style={styles.text}>{key}</Text>}
          </PressableScale>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  keypad: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  key: { width: '33.333%', height: 56, alignItems: 'center', justifyContent: 'center' },
  text: { color: sheet.ink, fontSize: 27, fontWeight: '500' },
});
