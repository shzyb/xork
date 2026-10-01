import { Switch } from 'react-native';
import { sheet, useColors } from '../theme';

// The app's on/off switch: ink-coloured when on, soft grey when off. `onSheet` is for the always-dark sheets and forms.
export function Toggle({ value, onValueChange, onSheet, accessibilityLabel }: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  onSheet?: boolean;
  accessibilityLabel: string;
}) {
  const colors = useColors();
  const palette = onSheet
    ? { on: sheet.ink, off: sheet.card2, thumbOn: sheet.bg, thumbOff: sheet.ink3 }
    : { on: colors.ink, off: colors.fill2, thumbOn: colors.bg, thumbOff: colors.ink3 };

  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ true: palette.on, false: palette.off }}
      thumbColor={value ? palette.thumbOn : palette.thumbOff}
      ios_backgroundColor={palette.off}
    />
  );
}
