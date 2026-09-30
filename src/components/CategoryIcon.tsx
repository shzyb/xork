import {
  BookOpen, Briefcase, Bus, Clapperboard, CreditCard, Dumbbell, Fuel, Gift, HandHeart, HeartPulse,
  House, KeyRound, Landmark, Laptop, Plane, Receipt, Repeat, ShieldCheck, ShoppingBag, ShoppingCart,
  Smartphone, Sofa, Sparkle, Sparkles, Store, Tag, TrendingUp, Undo2, Users, Utensils, Wifi, Wrench,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

const ICONS: Record<string, LucideIcon> = {
  'book-open': BookOpen, briefcase: Briefcase, bus: Bus, clapperboard: Clapperboard,
  'credit-card': CreditCard, dumbbell: Dumbbell, fuel: Fuel, gift: Gift, 'hand-heart': HandHeart,
  'heart-pulse': HeartPulse, house: House, 'key-round': KeyRound, landmark: Landmark, laptop: Laptop,
  plane: Plane, receipt: Receipt, repeat: Repeat, 'shield-check': ShieldCheck,
  'shopping-bag': ShoppingBag, 'shopping-cart': ShoppingCart, smartphone: Smartphone, sofa: Sofa,
  sparkle: Sparkle, sparkles: Sparkles, store: Store, tag: Tag, 'trending-up': TrendingUp,
  'undo-2': Undo2, users: Users, utensils: Utensils, wifi: Wifi, wrench: Wrench,
};

export const CATEGORY_ICONS = Object.keys(ICONS);

// A round coloured circle with the category's Lucide icon in white.
export function CategoryIcon({ name, color, size = 44 }: {
  name: string | null;
  color: string | null;
  size?: number;
}) {
  const Icon = (name && ICONS[name]) || Tag;
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? '#64748B' }]}>
      <Icon color="#FFFFFF" size={size * 0.46} strokeWidth={2.1} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
