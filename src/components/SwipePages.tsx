import { useEffect, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, tabBarHeight } from '../theme';

// The content under a row of tab labels, one page per tab, that you can swipe between.
// It sits inside a screen that scrolls vertically with `spacing.xl` side padding and the bottom tab bar.
// Each page is at least as tall as the free space below the labels (so a swipe works on a short list and an
// EmptyState can centre itself in it) and grows with its content.
export function SwipePages<T extends string>({ keys, active, onChange, renderPage }: {
  keys: T[];
  active: T;
  onChange: (key: T) => void;
  renderPage: (key: T) => ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pager = useRef<ScrollView>(null);
  const [top, setTop] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const pageWidth = width - spacing.xl * 2;
  const minHeight = Math.max(0, height - insets.top - top - tabBarHeight - insets.bottom);
  const activeHeight = heights[active] ?? 0;

  // Tapping a tab label changes `active`; slide to it. After a swipe the page is already there.
  useEffect(() => {
    pager.current?.scrollTo({ x: keys.indexOf(active) * pageWidth, animated: true });
  }, [active, pageWidth]);

  return (
    <ScrollView
      ref={pager}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={(e) => onChange(keys[Math.round(e.nativeEvent.contentOffset.x / pageWidth)] ?? active)}
      contentContainerStyle={{ alignItems: 'flex-start' }}
      onLayout={(e) => setTop(e.nativeEvent.layout.y)}
      style={[activeHeight > 0 && { height: activeHeight }, { minHeight }]}
    >
      {keys.map((key) => (
        <View
          key={key}
          style={{ width: pageWidth, minHeight }}
          onLayout={(e) => {
            const pageHeight = e.nativeEvent.layout.height;
            setHeights((prev) => (prev[key] === pageHeight ? prev : { ...prev, [key]: pageHeight }));
          }}
        >
          {renderPage(key)}
        </View>
      ))}
    </ScrollView>
  );
}
