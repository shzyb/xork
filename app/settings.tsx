import * as DocumentPicker from 'expo-document-picker';
import { FadeScrollView } from '../src/components/FadeScrollView';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { CalendarDays, ChevronLeft, ChevronRight, Download, FlaskConical, Globe, SunMoon, Tag, Trash2, Upload } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListHeading } from '../src/components/ListHeading';
import { PressableScale } from '../src/components/PressableScale';
import { parseBackup } from '../src/backup';
import { deleteAllData, exportAll, getPayday, getSetting, replaceAllData, setLastBackup } from '../src/db';
import { fullDate, ordinalDay, today } from '../src/dates';
import { buildDemoBackup } from '../src/demoData';
import { currencyOf } from '../src/money';
import { fontSize, spacing, useColors } from '../src/theme';
import { THEME_OPTIONS } from '../src/types';
import type { Payday } from '../src/types';
import { useData } from '../src/useData';
import { Text } from '../src/components/Text';

const confirm = (title: string, message: string, action: string) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: action, style: 'destructive', onPress: () => resolve(true) },
      ],
      { onDismiss: () => resolve(false) },
    ),
  );

// Settings, in three groups: how the money works, how the app looks, and the data. Delete sits apart at the bottom.
export default function Settings() {
  const colors = useColors();
  const router = useRouter();
  const currencyCode = useData(() => getSetting('currency'));
  const themeSetting = useData(() => getSetting('theme'));
  const payday = useData(getPayday);
  const lastBackup = useData(() => getSetting('last_backup'));
  const [busy, setBusy] = useState<'export' | 'import' | 'demo' | null>(null);
  const [message, setMessage] = useState('');

  const current = currencyOf(currencyCode ?? 'USD');
  const theme = THEME_OPTIONS.find((o) => o.value === themeSetting) ?? THEME_OPTIONS[0];

  async function exportBackup() {
    setMessage('');
    setBusy('export');
    try {
      if (!(await Sharing.isAvailableAsync())) return setMessage('Sharing is not available on this phone.');
      const file = new File(Paths.cache, `dimedog-backup-${today()}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(await exportAll()));
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Dimedog backup' });
      await setLastBackup(today());
    } catch {
      setMessage('Could not export. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function importBackup() {
    setMessage('');
    setBusy('import');
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (picked.canceled) return;
      const parsed = parseBackup(await new File(picked.assets[0].uri).text());
      if (!parsed.ok) return setMessage(parsed.error);
      const { backup } = parsed;
      const ok = await confirm(
        'Replace everything on this phone?',
        `This backup has ${backup.accounts.length} account${backup.accounts.length === 1 ? '' : 's'} and ${backup.transactions.length} transaction${backup.transactions.length === 1 ? '' : 's'}. It replaces all current data and cannot be undone.`,
        'Replace',
      );
      if (!ok) return;
      await replaceAllData(backup);
      setMessage(`Restored ${backup.transactions.length} transaction${backup.transactions.length === 1 ? '' : 's'}.`);
    } catch {
      setMessage('Could not import. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function addDemoData() {
    setMessage('');
    const ok = await confirm(
      'Replace everything with demo data?',
      'This deletes all your accounts, transactions, categories and recurring items and fills the app with about 2 years of made-up data. It cannot be undone.',
      'Replace',
    );
    if (!ok) return;
    setBusy('demo');
    try {
      await replaceAllData(buildDemoBackup(currencyCode ?? 'USD', today()));
    } catch {
      setMessage('Could not add demo data. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function deleteEverything() {
    setMessage('');
    const ok = await confirm(
      'Delete all data?',
      'This removes every account, transaction, category and recurring item from this phone. Export a backup first if you might want it back.',
      'Delete everything',
    );
    if (!ok) return;
    try {
      await deleteAllData();
    } catch {
      setMessage('Could not delete. Try again.');
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <PressableScale accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <ChevronLeft color={colors.ink} size={26} />
      </PressableScale>
      <Text style={[styles.title, { color: colors.ink }]}>Settings</Text>
      <FadeScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <ListHeading>Money</ListHeading>
        <ActionRow
          Icon={CalendarDays}
          title="Payday"
          subtitle={paydaySummary(payday)}
          onPress={() => router.push('/payday')}
        />
        <ActionRow
          Icon={Globe}
          title="Currency"
          subtitle={`${current.name} (${current.code})`}
          onPress={() => router.push('/currency')}
        />
        <ActionRow
          Icon={Tag}
          title="Categories & budgets"
          subtitle="Create categories, set monthly limits"
          onPress={() => router.push('/categories')}
        />

        <ListHeading>Look</ListHeading>
        <ActionRow
          Icon={SunMoon}
          title="Appearance"
          subtitle={theme.label}
          onPress={() => router.push('/appearance')}
        />

        <ListHeading>Your data</ListHeading>
        <ActionRow
          Icon={Download}
          title={busy === 'export' ? 'Exporting…' : 'Export backup'}
          subtitle={lastBackup ? `Last saved ${fullDate(lastBackup)}` : 'Save all your data to a file. None saved yet'}
          disabled={busy !== null}
          onPress={exportBackup}
        />
        <ActionRow
          Icon={Upload}
          title={busy === 'import' ? 'Importing…' : 'Import backup'}
          subtitle="Replace everything with a backup file"
          disabled={busy !== null}
          onPress={importBackup}
        />

        {__DEV__ && (
          <>
            <ListHeading>Development</ListHeading>
            <ActionRow
              Icon={FlaskConical}
              title={busy === 'demo' ? 'Adding…' : 'Add 2 years of demo data'}
              subtitle="Replaces everything"
              disabled={busy !== null}
              onPress={addDemoData}
            />
          </>
        )}

        <View style={styles.danger}>
          <ActionRow
            Icon={Trash2}
            title="Delete all data"
            subtitle="Start again with an empty app"
            danger
            onPress={deleteEverything}
          />
        </View>

        {message !== '' && <Text style={[styles.message, { color: colors.ink }]}>{message}</Text>}
        <Text style={[styles.note, { color: colors.ink2 }]}>
          Your data lives only on this phone. Nothing is sent anywhere. Export a backup to keep it safe.
        </Text>
      </FadeScrollView>
    </SafeAreaView>
  );
}

function paydaySummary(p: Payday | undefined): string {
  if (!p) return '';
  if (p.mode === 'start') return `Month starts on the ${ordinalDay(p.startDay)}`;
  return p.salaryId === null ? 'Starts from a salary, not picked yet' : 'Starts from a salary transaction';
}

function ActionRow({ Icon, title, subtitle, onPress, disabled, danger }: {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, disabled && { opacity: 0.5 }]}
    >
      <View style={[styles.actionIcon, { backgroundColor: colors.fill }]}>
        <Icon color={danger ? colors.neg : colors.ink} size={20} />
      </View>
      <View style={styles.main}>
        <Text style={[styles.rowTitle, { color: danger ? colors.neg : colors.ink }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: colors.ink2 }]}>{subtitle}</Text>
      </View>
      {!danger && <ChevronRight color={colors.ink3} size={20} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  flex: { flex: 1 },
  back: { width: 44, height: 44, marginLeft: -10, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize.screen, fontWeight: '800', marginBottom: spacing.sm },
  content: { paddingBottom: spacing.xxl },
  danger: { marginTop: spacing.xl },
  message: { fontSize: 14.5, fontWeight: '600', marginTop: 10 },
  note: { fontSize: 13.5, lineHeight: 20, marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 68 },
  main: { flex: 1 },
  rowTitle: { fontSize: 16.5, fontWeight: '600' },
  rowSub: { fontSize: 14 },
  actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
