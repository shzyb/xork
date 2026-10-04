import { lastEmoji, suggestEmoji, toEmoji } from '../emoji';

describe('toEmoji', () => {
  it('turns an old icon name into its emoji and leaves an emoji alone', () => {
    expect(toEmoji('shopping-cart')).toBe('🛒');
    expect(toEmoji('🍕')).toBe('🍕');
  });
});

describe('suggestEmoji', () => {
  it('suggests from words in the name, whatever the case', () => {
    expect(suggestEmoji('Pizza night')[0]).toBe('🍕');
    expect(suggestEmoji('GYM').includes('🏋️')).toBe(true);
  });

  it('gives at most 5 different emoji, and none for an unknown name', () => {
    expect(suggestEmoji('food coffee pizza gym fuel car bike').length).toBe(5);
    expect(suggestEmoji('Zzzzz')).toEqual([]);
    expect(suggestEmoji('   ')).toEqual([]);
  });
});

describe('lastEmoji', () => {
  it('takes the newest emoji typed after the old one', () => {
    expect(lastEmoji('🍕🍔')).toBe('🍔');
  });

  it('keeps joined emoji, skin tones, flags and variation selectors whole', () => {
    expect(lastEmoji('🍕👨‍👩‍👧')).toBe('👨‍👩‍👧');
    expect(lastEmoji('👍🏽')).toBe('👍🏽');
    expect(lastEmoji('🇵🇰')).toBe('🇵🇰');
    expect(lastEmoji('🏋️')).toBe('🏋️');
  });

  it('ignores letters, digits and spaces, and gives nothing when there is no emoji', () => {
    expect(lastEmoji('abc 12')).toBe('');
    expect(lastEmoji('🍕 x')).toBe('🍕');
    expect(lastEmoji('')).toBe('');
  });
});
