import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColors } from '../theme';
import { FadeScrollView } from './FadeScrollView';

const EDGE = 80; // within this many px of the top or bottom, dragging scrolls the list
const SCROLL_STEP = 12;

// A scrolling page whose rows (all `rowHeight` tall) can be reordered: press and hold a row, drag it, let go.
// `header` and `footer` scroll with the rows but cannot be dragged. onReorder gets the ids in their new order.
export function DragList<T extends { id: number }>({ items, rowHeight, renderRow, onReorder, header, footer, style, contentContainerStyle }: {
  items: T[];
  rowHeight: number;
  renderRow: (item: T) => ReactNode;
  onReorder: (ids: number[]) => Promise<void>;
  header: ReactNode;
  footer: ReactNode;
  style: StyleProp<ViewStyle>;
  contentContainerStyle: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const scroll = useRef<ScrollView>(null);
  const box = useRef<View>(null);
  const scrollY = useRef(0);
  const viewport = useRef({ top: 0, bottom: 0 });
  const drag = useRef({ from: -1, over: -1, startScroll: 0, translation: 0, absoluteY: 0 });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const offset = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState<{ from: number; over: number } | null>(null);

  // After a drop the rows stay where they were dropped until the saved order comes back from the database.
  const [pending, setPending] = useState<number[] | null>(null);
  const key = items.map((item) => item.id).join();
  useEffect(() => {
    if (pending && pending.join() === key) setPending(null);
  }, [key, pending]);
  const shown = pending && pending.length === items.length
    ? pending.flatMap((id) => items.filter((item) => item.id === id))
    : items;

  function move(translation: number, absoluteY: number) {
    const d = drag.current;
    d.translation = translation;
    d.absoluteY = absoluteY;
    const delta = translation + scrollY.current - d.startScroll;
    offset.setValue(delta);
    const over = Math.max(0, Math.min(shown.length - 1, Math.round(d.from + delta / rowHeight)));
    if (over !== d.over) {
      d.over = over;
      setActive({ from: d.from, over });
    }
  }

  // While the finger is near the top or bottom edge, keep scrolling. The scroll event then re-runs move().
  function autoScroll() {
    const { absoluteY } = drag.current;
    const { top, bottom } = viewport.current;
    if (absoluteY < top + EDGE) scroll.current?.scrollTo({ y: Math.max(0, scrollY.current - SCROLL_STEP), animated: false });
    else if (absoluteY > bottom - EDGE) scroll.current?.scrollTo({ y: scrollY.current + SCROLL_STEP, animated: false });
  }

  function drop() {
    const { from, over } = drag.current;
    if (from < 0 || from === over) return;
    const ids = shown.map((item) => item.id);
    ids.splice(over, 0, ...ids.splice(from, 1));
    setPending(ids);
    onReorder(ids).catch(() => setPending(null));
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    drag.current.from = -1;
    offset.setValue(0);
    setActive(null);
  }

  function rowGesture(index: number) {
    return Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(250)
      .onStart((e) => {
        drag.current = { from: index, over: index, startScroll: scrollY.current, translation: 0, absoluteY: e.absoluteY };
        offset.setValue(0);
        setActive({ from: index, over: index });
        timer.current = setInterval(autoScroll, 16);
      })
      .onUpdate((e) => move(e.translationY, e.absoluteY))
      .onEnd((_e, success) => {
        if (success) drop();
      })
      .onFinalize(stop);
  }

  function rowStyle(index: number) {
    if (!active) return null;
    if (index === active.from) return [styles.lifted, { backgroundColor: colors.bg, transform: [{ translateY: offset }] }];
    if (index > active.from && index <= active.over) return { transform: [{ translateY: -rowHeight }] };
    if (index < active.from && index >= active.over) return { transform: [{ translateY: rowHeight }] };
    return null;
  }

  return (
    <GestureHandlerRootView style={style}>
      <View
        ref={box}
        style={styles.fill}
        onLayout={() => box.current?.measureInWindow((_x, y, _w, h) => { viewport.current = { top: y, bottom: y + h }; })}
      >
        <FadeScrollView
          ref={scroll}
          scrollEnabled={!active}
          contentContainerStyle={contentContainerStyle}
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
            if (drag.current.from >= 0) move(drag.current.translation, drag.current.absoluteY);
          }}
        >
          {header}
          <View>
            {shown.map((item, index) => (
              <GestureDetector key={item.id} gesture={rowGesture(index)}>
                <Animated.View style={[{ height: rowHeight }, rowStyle(index)]}>{renderRow(item)}</Animated.View>
              </GestureDetector>
            ))}
          </View>
          {footer}
        </FadeScrollView>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  lifted: { zIndex: 1, elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});
