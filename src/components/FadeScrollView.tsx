import { useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import type { ScrollViewProps } from 'react-native';
import { fadingEdge } from '../theme';

// A vertical ScrollView that fades the top edge only once you have scrolled down, and the bottom edge only while
// there is more below. (React Native's own fadingEdgeLength on Android keeps both edges faded all the time.)
// `fadeTop={false}` is for a screen with a sticky header at the top.
export function FadeScrollView({ fadeTop = true, onScroll, onLayout, onContentSizeChange, ...rest }: ScrollViewProps & { fadeTop?: boolean }) {
  const [start, setStart] = useState(false);
  const [end, setEnd] = useState(false);
  const measured = useRef({ y: 0, view: 0, content: 0 });

  function update() {
    const { y, view, content } = measured.current;
    setStart(y > 4);
    setEnd(content - view - y > 4);
  }

  return (
    <ScrollView
      {...rest}
      scrollEventThrottle={16}
      fadingEdgeLength={{ start: fadeTop && start ? fadingEdge : 0, end: end ? fadingEdge : 0 }}
      onScroll={(e) => {
        measured.current.y = e.nativeEvent.contentOffset.y;
        update();
        onScroll?.(e);
      }}
      onLayout={(e) => {
        measured.current.view = e.nativeEvent.layout.height;
        update();
        onLayout?.(e);
      }}
      onContentSizeChange={(w, h) => {
        measured.current.content = h;
        update();
        onContentSizeChange?.(w, h);
      }}
    />
  );
}
