import { createContext, useContext } from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput } from 'react-native';
import type { TextInputProps, TextProps, TextStyle } from 'react-native';

// Open Runde ships one file per weight, and React Native cannot pick a file from `fontWeight` for custom fonts.
// So screens keep writing fontWeight as usual and these two components turn it into the right font family.
export const FONT_FILES = {
  'OpenRunde-Regular': require('../../assets/fonts/OpenRunde-Regular.otf'),
  'OpenRunde-Medium': require('../../assets/fonts/OpenRunde-Medium.otf'),
  'OpenRunde-Semibold': require('../../assets/fonts/OpenRunde-Semibold.otf'),
  'OpenRunde-Bold': require('../../assets/fonts/OpenRunde-Bold.otf'),
};

export function familyFor(weight: TextStyle['fontWeight']): string {
  const w = String(weight ?? '400');
  if (w === '500') return 'OpenRunde-Medium';
  if (w === '600') return 'OpenRunde-Semibold';
  if (w === '700' || w === '800' || w === '900' || w === 'bold') return 'OpenRunde-Bold';
  return 'OpenRunde-Regular';
}

const InsideText = createContext(false);

// Text inside Text inherits the outer font unless it sets its own weight.
export function Text({ style, ...rest }: TextProps) {
  const inside = useContext(InsideText);
  const flat = StyleSheet.flatten(style) ?? {};
  const own = flat.fontWeight !== undefined || !inside;
  return (
    <InsideText.Provider value>
      <RNText {...rest} style={own ? { ...flat, fontFamily: familyFor(flat.fontWeight), fontWeight: 'normal' } : flat} />
    </InsideText.Provider>
  );
}

export function TextInput({ style, ...rest }: TextInputProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  return <RNTextInput {...rest} style={{ ...flat, fontFamily: familyFor(flat.fontWeight), fontWeight: 'normal' }} />;
}
