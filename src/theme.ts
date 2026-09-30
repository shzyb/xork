import { useColorScheme } from 'react-native';

const light = {
  bg: '#FFFFFF',
  ink: '#0A0A0A',
  ink2: '#6C6C70',
  ink3: '#AEAEB2',
  fill: '#F2F2F4',
  fill2: '#E4E4E8',
  line: '#EDEDF0',
  pos: '#18913F',
  neg: '#E5342A',
  btnBg: '#0A0A0A',
  btnFg: '#FFFFFF',
};

const dark: typeof light = {
  bg: '#000000',
  ink: '#F5F5F7',
  ink2: '#98989D',
  ink3: '#5A5A5E',
  fill: '#1C1C1E',
  fill2: '#2C2C2E',
  line: '#1C1C1E',
  pos: '#4ADE80',
  neg: '#FF6B61',
  btnBg: '#F5F5F7',
  btnFg: '#000000',
};

export function useColors() {
  return useColorScheme() === 'dark' ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 32 };

export const fontSize = { small: 13, body: 16, title: 22, screen: 32, big: 52 };

// Every action opens in this black sheet, in light and dark mode alike.
export const sheet = {
  bg: '#0B0B0C',
  card: '#1C1C1E',
  card2: '#2C2C2E',
  ink: '#FFFFFF',
  ink2: '#A1A1A6',
  ink3: '#636366',
  neg: '#FF6B61',
  pos: '#4ADE80',
  btnBg: '#FFFFFF',
  btnFg: '#000000',
};
