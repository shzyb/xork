import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { isOnboarded, logDueRecurring, openDb } from '../src/db';
import { sheet } from '../src/theme';
import { useData } from '../src/useData';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  // Due recurring items are logged before the splash hides, so Home opens already up to date.
  useEffect(() => {
    openDb().then(logDueRecurring).then(() => setDbReady(true));
  }, []);

  // ...and again whenever the app comes back to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && dbReady) logDueRecurring();
    });
    return () => subscription.remove();
  }, [dbReady]);

  return dbReady ? <Routes /> : null;
}

function Routes() {
  const onboarded = useData(isOnboarded);

  useEffect(() => {
    if (onboarded !== undefined) SplashScreen.hideAsync();
  }, [onboarded]);

  if (onboarded === undefined) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add-menu"
          options={{ presentation: 'transparentModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: 'rgba(0,0,0,0.32)' } }}
        />
        {['add', 'transaction/[id]', 'account/[id]', 'category/[id]', 'recurring/[id]', 'settings'].map((name) => (
          <Stack.Screen key={name} name={name} options={{ presentation: 'modal', contentStyle: { backgroundColor: sheet.bg } }} />
        ))}
      </Stack.Protected>
    </Stack>
  );
}
