import { useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { subscribe } from './db';

// Runs `load` on mount, after every write anywhere in the app, and when the screen regains focus.
// Returns undefined until the first result arrives, so screens render nothing meanwhile.
export function useData<T>(load: () => Promise<T>): T | undefined {
  const [data, setData] = useState<T>();
  const loadRef = useRef(load);
  loadRef.current = load;
  const navigation = useNavigation();

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      loadRef.current().then((result) => {
        if (alive) setData(result);
      });
    };
    refresh();
    const unsubscribe = subscribe(refresh);
    const unfocus = navigation.addListener('focus', refresh);
    return () => {
      alive = false;
      unsubscribe();
      unfocus();
    };
  }, [navigation]);

  return data;
}
