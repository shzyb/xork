import { useRef, useState } from 'react';
import type { Ref } from 'react';
import { ScrollView } from 'react-native';
import type { ScrollViewProps } from 'react-native';
import { fadingEdge } from '../theme';

// A ScrollView that fades its start edge only once you have scrolled, and its end edge only while there is more
// beyond it. (React Native's own fadingEdgeLength on Android keeps both edges faded all the time.)
// Vertical by default; with `horizontal` it fades left and right, at half the length to suit a short row.
// `fadeTop={false}` is for a screen with a sticky header at the top.
export function FadeScrollView({ fadeTop = true, onScroll, onLayout, onContentSizeChange, ...rest }: ScrollViewProps & { fadeTop?: boolean; ref?: Ref<ScrollView> }) {
  const [start, setStart] = useState(false);
  const [end, setEnd] = useState(false);
  const measured = useRef({ y: 0, view: 0, content: 0 });
  const horizontal = rest.horizontal === true;
  const length = horizontal ? fadingEdge / 2 : fadingEdge;

  function update() {
    const { y, view, content } = measured.current;
    setStart(y > 4);
    setEnd(content - view - y > 4);
  }

  return (
    <ScrollView
      {...rest}
      scrollEventThrottle={16}
      fadingEdgeLength={{ start: fadeTop && start ? length : 0, end: end ? length : 0 }}
      onScroll={(e) => {
        measured.current.y = horizontal ? e.nativeEvent.contentOffset.x : e.nativeEvent.contentOffset.y;
        update();
        onScroll?.(e);
      }}
      onLayout={(e) => {
        measured.current.view = horizontal ? e.nativeEvent.layout.width : e.nativeEvent.layout.height;
        update();
        onLayout?.(e);
      }}
      onContentSizeChange={(w, h) => {
        measured.current.content = horizontal ? w : h;
        update();
        onContentSizeChange?.(w, h);
      }}
    />
  );
}
