import * as DocumentPicker from 'expo-document-picker';
import { FadeScrollView } from '../src/components/FadeScrollView';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ChevronRight, Download, Globe, Landmark, Tag, Trash2, Upload } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { parseBackup } from '../src/backup';
import { Sheet } from '../src/components/Sheet';
import { SheetHeader } from '../src/components/SheetHeader';
import { deleteAllData, exportAll, getSetting, replaceAllData } from '../src/db';
import { today } from '../src/dates';
import { currencyOf } from '../src/money';
import { sheet, spacing } from '../src/theme';
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

export default function Settings() {
  const router = useRouter();
  const currencyCode = useData(() => getSetting('currency'));
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [message, setMessage] = useState('');

  const current = currencyOf(currencyCode ?? 'USD');

  async function exportBackup() {
    setMessage('');
    setBusy('export');
    try {
      if (!(await Sharing.isAvailableAsync())) return setMessage('Sharing is not available on this phone.');
      const file = new File(Paths.cache, `xork-backup-${today()}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(await exportAll()));
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Xork backup' });
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
    <Sheet onClose={() => router.back()}>
      <SheetHeader title="Settings" onClose={() => router.back()} />
      <FadeScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ActionRow
          Icon={Landmark}
          title="Accounts"
          subtitle="Add, edit or remove accounts"
          onPress={() => router.push('/accounts')}
          end={<ChevronRight color={sheet.ink3} size={20} />}
        />
        <ActionRow
          Icon={Tag}
          title="Categories & budgets"
          subtitle="Create categories, set monthly limits"
          onPress={() => router.push('/categories')}
          end={<ChevronRight color={sheet.ink3} size={20} />}
        />
        <ActionRow
          Icon={Globe}
          title="Currency"
          subtitle={`${current.name} (${current.code})`}
          onPress={() => router.push('/currency')}
          end={<ChevronRight color={sheet.ink3} size={20} />}
        />
        <ActionRow
          Icon={Download}
          title={busy === 'export' ? 'Exporting…' : 'Export backup'}
          subtitle="Save all your data to a file"
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
        <ActionRow
          Icon={Trash2}
          title="Delete all data"
          subtitle="Start again with an empty app"
          danger
          onPress={deleteEverything}
        />
        {message !== '' && <Text style={styles.message}>{message}</Text>}
        <Text style={styles.note}>
          Your data lives only on this phone. Nothing is sent anywhere. Export a backup to keep it safe.
        </Text>
      </FadeScrollView>
    </Sheet>
  );
}

function ActionRow({ Icon, title, subtitle, onPress, end, disabled, danger }: {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  end?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, disabled && { opacity: 0.5 }]}
    >
      <View style={styles.actionIcon}>
        <Icon color={danger ? sheet.neg : sheet.ink} size={20} />
      </View>
      <View style={styles.main}>
        <Text style={[styles.rowTitle, danger && { color: sheet.neg }]}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      {end}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  content: { paddingBottom: spacing.xxl },
  message: { color: sheet.ink, fontSize: 14.5, fontWeight: '600', marginTop: 10 },
  note: { color: sheet.ink2, fontSize: 13.5, lineHeight: 20, marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 68 },
  main: { flex: 1 },
  rowTitle: { color: sheet.ink, fontSize: 16.5, fontWeight: '600' },
  rowSub: { color: sheet.ink2, fontSize: 14 },
  actionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: sheet.card, alignItems: 'center', justifyContent: 'center' },
});
