import { Repeat } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme';

// A round circle tinted with the category's colour, with its emoji in the middle. `name` holds the emoji.
// `recurring` adds a small repeat badge; `surface` is the colour behind the icon, used for the badge's ring.
export function CategoryIcon({ name, color, size = 44, recurring, surface }: {
  name: string | null;
  color: string | null;
  size?: number;
  recurring?: boolean;
  surface?: string;
}) {
  const colors = useColors();
  const badge = size > 50 ? 24 : 19;
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${color ?? '#64748B'}33` }]}>
      <Text style={{ fontSize: size * 0.48, lineHeight: size * 0.62, includeFontPadding: false }}>{name || '🏷️'}</Text>
      {recurring && (
        <View
          style={[
            styles.badge,
            { width: badge + 5, height: badge + 5, borderRadius: (badge + 5) / 2, borderColor: surface ?? colors.bg, borderWidth: 2.5 },
          ]}
        >
          <Repeat color="#FFFFFF" size={badge * 0.52} strokeWidth={2.6} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: -4, bottom: -4, backgroundColor: '#6C6C70', alignItems: 'center', justifyContent: 'center' },
});
