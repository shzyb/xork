import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { isOnboarded, openDb } from '../src/db';
import { sheet } from '../src/theme';
import { useData } from '../src/useData';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    openDb().then(() => setDbReady(true));
  }, []);

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
          name="add"
          options={{ presentation: 'modal', contentStyle: { backgroundColor: sheet.bg } }}
        />
      </Stack.Protected>
    </Stack>
  );
}
