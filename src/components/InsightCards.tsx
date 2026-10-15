import { CalendarClock, Gauge, PiggyBank, Receipt, TrendingUp, TriangleAlert, Wallet } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { Note } from '../notes';
import { spacing, useColors } from '../theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

const ICONS: Record<Note['icon'], LucideIcon> = {
  'triangle-alert': TriangleAlert,
  gauge: Gauge,
  receipt: Receipt,
  'trending-up': TrendingUp,
  calendar: CalendarClock,
  wallet: Wallet,
  'piggy-bank': PiggyBank,
};

// The colour of the notes that are neither good nor bad news.
const NEUTRAL: Partial<Record<Note['icon'], string>> = { receipt: '#3B82F6', calendar: '#8B5CF6', wallet: '#14B8A6' };

// The "Worth a look" cards on Insights, side by side. A card about one category opens it.
export function InsightCards({ notes, width, onOpen }: { notes: Note[]; width: number; onOpen: (note: Note) => void }) {
  const colors = useColors();
  const cardWidth = Math.round(width * 0.72);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={cardWidth + 12}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {notes.map((note, i) => {
        const Icon = ICONS[note.icon];
        const tone = note.tone === 'good' ? colors.pos : note.tone === 'bad' ? colors.neg : note.tone === 'warn' ? colors.warn : (NEUTRAL[note.icon] ?? colors.ink);
        const opens = note.categoryId !== undefined;
        return (
          <PressableScale
            key={i}
            accessibilityRole={opens ? 'button' : undefined}
            disabled={!opens}
            onPress={() => onOpen(note)}
            style={[styles.card, { width: cardWidth, backgroundColor: `${tone}26` }]}
          >
            <View style={[styles.icon, { backgroundColor: tone }]}>
              <Icon color="#FFFFFF" size={17} strokeWidth={2.2} />
            </View>
            <View>
              <Text style={[styles.value, { color: tone }]}>{note.value}</Text>
              <Text style={{ color: colors.ink2, fontSize: 14, lineHeight: 20, marginTop: 2 }}>{note.detail}</Text>
            </View>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -spacing.xl },
  content: { paddingHorizontal: spacing.xl, gap: 12 },
  card: { borderRadius: 20, padding: 16, gap: 12 },
  value: { fontSize: 28, fontWeight: '700' },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
