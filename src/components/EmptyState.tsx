import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { useColors } from '../theme';
import { Text } from './Text';

// Fills the space it is given and centres an icon, a title and a short line under it.
// Put it in a parent that is as tall as the free space on the screen (SwipePages pages are).
export function EmptyState({ Icon, title, text, children }: { Icon: LucideIcon; title: string; text: string; children?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.box}>
      <View style={[styles.icon, { backgroundColor: colors.fill }]}>
        <Icon color={colors.ink2} size={30} strokeWidth={1.8} />
      </View>
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.text, { color: colors.ink2 }]}>{text}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // flexGrow without flex's zero basis: the box is at least as tall as its content, so a short page can't clip it.
  box: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 24 },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  text: { fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 290 },
});
