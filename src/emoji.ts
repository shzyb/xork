// Category emoji: the names the old icons had, and a few suggestions for a typed category name.

// The old Lucide icon names, and the emoji that replace them.
const ICON_EMOJI: Record<string, string> = {
  'book-open': '📚', briefcase: '💼', bus: '🚌', clapperboard: '🎬', 'credit-card': '💳', dumbbell: '🏋️',
  fuel: '⛽', gift: '🎁', 'hand-heart': '🤲', 'heart-pulse': '🩺', house: '🏠', 'key-round': '🔑',
  landmark: '🏦', laptop: '💻', plane: '✈️', receipt: '🧾', repeat: '🔁', 'shield-check': '🛡️',
  'shopping-bag': '🛍️', 'shopping-cart': '🛒', smartphone: '📱', sofa: '🛋️', sparkle: '💰', sparkles: '✨',
  store: '🏪', tag: '🏷️', 'trending-up': '📈', 'undo-2': '↩️', users: '👨‍👩‍👧', utensils: '🍽️',
  wifi: '📶', wrench: '🔧',
};

export const ICON_NAMES = Object.keys(ICON_EMOJI);

// An old icon name becomes its emoji. Anything else (already an emoji) is returned as it is.
export function toEmoji(icon: string): string {
  return ICON_EMOJI[icon] ?? icon;
}

// Words in a category name, and the emoji that usually go with them. Earlier entries win.
const SUGGESTIONS: [string[], string][] = [
  [['grocer', 'supermarket', 'vegetable', 'fruit'], '🛒'],
  [['dining', 'restaurant', 'eat out', 'lunch', 'dinner', 'food'], '🍽️'],
  [['pizza'], '🍕'], [['burger', 'fast food'], '🍔'], [['coffee', 'cafe', 'tea'], '☕'], [['snack', 'sweet', 'dessert'], '🍰'],
  [['drink', 'juice', 'soda'], '🥤'], [['alcohol', 'beer', 'wine', 'bar'], '🍺'], [['breakfast'], '🍳'],
  [['transport', 'bus', 'commute', 'metro'], '🚌'], [['taxi', 'uber', 'careem', 'ride'], '🚕'],
  [['fuel', 'petrol', 'gas', 'diesel'], '⛽'], [['car', 'vehicle', 'parking'], '🚗'], [['bike', 'motorcycle'], '🏍️'],
  [['bill', 'utilit'], '🧾'], [['electric', 'power'], '💡'], [['water'], '🚰'],
  [['rent', 'mortgage', 'house', 'home'], '🏠'], [['furniture', 'decor'], '🛋️'],
  [['mobile', 'phone', 'recharge'], '📱'], [['internet', 'wifi', 'broadband'], '📶'],
  [['subscription', 'netflix', 'spotify', 'membership'], '🔁'],
  [['shopping', 'clothes', 'fashion', 'shoes'], '🛍️'],
  [['health', 'doctor', 'medic', 'pharmacy', 'hospital'], '🩺'], [['dental', 'dentist'], '🦷'],
  [['family', 'kids', 'children', 'baby'], '👨‍👩‍👧'], [['pet', 'dog'], '🐶'], [['cat'], '🐱'],
  [['education', 'school', 'course', 'book', 'tuition', 'study'], '📚'],
  [['entertain', 'movie', 'cinema', 'fun'], '🎬'], [['game', 'gaming'], '🎮'], [['music'], '🎵'],
  [['travel', 'trip', 'flight', 'holiday', 'vacation'], '✈️'], [['hotel'], '🏨'],
  [['personal', 'beauty', 'salon', 'haircut', 'grooming'], '✨'],
  [['fitness', 'gym', 'workout', 'sport'], '🏋️'],
  [['charity', 'donat', 'zakat', 'sadaqah'], '🤲'],
  [['maintenance', 'repair', 'fix'], '🔧'], [['insurance'], '🛡️'], [['loan', 'debt', 'bank'], '🏦'],
  [['emi', 'credit card', 'installment'], '💳'], [['tax'], '🧾'], [['laundry'], '🧺'], [['gift', 'present'], '🎁'],
  [['salary', 'wage', 'paycheck', 'job'], '💼'], [['freelance', 'side gig', 'project'], '💻'],
  [['business', 'shop', 'store', 'sales'], '🏪'], [['invest', 'stock', 'dividend', 'crypto'], '📈'],
  [['saving'], '🐷'], [['refund', 'return', 'cashback'], '↩️'], [['bonus', 'reward'], '🎉'],
  [['interest'], '💰'], [['other', 'misc'], '🏷️'],
];

// Up to 5 different emoji for a category name. Empty when the name matches nothing.
export function suggestEmoji(name: string): string[] {
  const text = name.trim().toLowerCase();
  if (text === '') return [];
  const found: string[] = [];
  for (const [words, emoji] of SUGGESTIONS) {
    if (words.some((word) => text.includes(word)) && !found.includes(emoji)) found.push(emoji);
  }
  return found.slice(0, 5);
}
