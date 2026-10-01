import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { FONT_FILES } from '../src/components/Text';
import { getSetting, isOnboarded, logDueRecurring, openDb } from '../src/db';
import { applyTheme, sheet } from '../src/theme';
import { useData } from '../src/useData';

SplashScreen.preventAutoHideAsync();

// Floating trays: a transparent modal with no router animation. The Sheet component fades the dim and slides the tray.
const TRAYS = ['add-menu', 'settings', 'currency', 'transaction/[id]', 'recurring/detail/[id]', 'account/detail/[id]'];
const TRAY_OPTIONS = { presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } } as const;

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);

  // Due recurring items are logged before the splash hides, so Home opens already up to date.
  useEffect(() => {
    openDb()
      .then(logDueRecurring)
      .then(async () => applyTheme(await getSetting('theme')))
      .then(() => setDbReady(true));
  }, []);

  // ...and again whenever the app comes back to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && dbReady) logDueRecurring();
    });
    return () => subscription.remove();
  }, [dbReady]);

  // The splash stays up until the data and the font are ready. If the font fails to load we carry on with the system font.
  return dbReady && (fontsLoaded || fontError) ? <Routes /> : null;
}

function Routes() {
  const onboarded = useData(isOnboarded);
  const theme = useData(() => getSetting('theme'));

  // The choice in Settings (or "Delete all data", which clears it) takes effect on every open screen.
  useEffect(() => {
    if (theme !== undefined) applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (onboarded !== undefined) SplashScreen.hideAsync();
  }, [onboarded]);

  if (onboarded === undefined) return null;

  return (
    <>
    <StatusBar style="auto" />
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" />
        {TRAYS.map((name) => (
          <Stack.Screen key={name} name={name} options={TRAY_OPTIONS} />
        ))}
        <Stack.Screen name="accounts" />
        <Stack.Screen name="categories" />
        {['add', 'account/[id]', 'category/[id]', 'recurring/[id]'].map((name) => (
          <Stack.Screen key={name} name={name} options={{ presentation: 'modal', contentStyle: { backgroundColor: sheet.bg } }} />
        ))}
      </Stack.Protected>
    </Stack>
    </>
  );
}
