import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { Check, ChevronDown, ChevronRight, Download, Globe, Trash2, Upload } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseBackup } from '../src/backup';
import { Button } from '../src/components/Button';
import { CategoryIcon } from '../src/components/CategoryIcon';
import { SheetHeader } from '../src/components/SheetHeader';
import { deleteAllData, exportAll, getCategories, getSetting, replaceAllData, setCurrency } from '../src/db';
import { today } from '../src/dates';
import { CURRENCIES, currencyOf, formatMoney } from '../src/money';
import { sheet, spacing } from '../src/theme';
import type { CategoryKind } from '../src/types';
import { useData } from '../src/useData';

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
  const categories = useData(getCategories);
  const currencyCode = useData(() => getSetting('currency'));
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [showCurrencies, setShowCurrencies] = useState(false);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [message, setMessage] = useState('');

  const current = currencyOf(currencyCode ?? 'USD');

  async function changeCurrency(code: string) {
    if (code === current.code) return;
    const next = currencyOf(code);
    const ok = await confirm(
      `Change to ${next.name}?`,
      `Amounts are not converted: 5,000 ${current.code} becomes 5,000 ${next.code}. Only the symbol and formatting change.`,
      'Change',
    );
    if (!ok) return;
    try {
      await setCurrency(code);
      setShowCurrencies(false);
    } catch {
      setMessage('Could not change the currency. Try again.');
    }
  }

  async function exportBackup() {
    setMessage('');
    setBusy('export');
    try {
      if (!(await Sharing.isAvailableAsync())) return setMessage('Sharing is not available on this phone.');
      const file = new File(Paths.cache, `hisaab-backup-${today()}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(await exportAll()));
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Hisaab backup' });
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
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <SheetHeader title="Settings" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>Currency</Text>
        <ActionRow
          Icon={Globe}
          title={current.name}
          subtitle={`${current.code} · ${formatMoney(123456)}`}
          onPress={() => setShowCurrencies(!showCurrencies)}
          end={showCurrencies ? <ChevronDown color={sheet.ink3} size={20} /> : <ChevronRight color={sheet.ink3} size={20} />}
        />
        {showCurrencies && CURRENCIES.map((c) => (
          <Pressable key={c.code} accessibilityRole="button" onPress={() => changeCurrency(c.code)} style={styles.currencyRow}>
            <Text style={styles.currencySymbol}>{c.symbol}</Text>
            <Text style={[styles.rowTitle, { flex: 1 }]}>{c.name} <Text style={styles.rowSub}>{c.code}</Text></Text>
            {c.code === current.code && <Check color={sheet.ink} size={20} />}
          </Pressable>
        ))}

        <Text style={styles.section}>Categories</Text>
        <View style={styles.segment}>
          {([['expense', 'Spending'], ['income', 'Income']] as const).map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: kind === key }}
              onPress={() => setKind(key)}
              style={[styles.segmentItem, kind === key && { backgroundColor: sheet.card2 }]}
            >
              <Text style={[styles.segmentText, kind === key && { color: sheet.ink }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {categories?.filter((c) => c.kind === kind).map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/category/[id]', params: { id: String(c.id) } })}
            style={styles.row}
          >
            <CategoryIcon name={c.icon} color={c.color} />
            <View style={styles.main}>
              <Text style={styles.rowTitle} numberOfLines={1}>{c.name}</Text>
              {c.budget_minor !== null && <Text style={styles.rowSub}>Budget {formatMoney(c.budget_minor)}</Text>}
            </View>
            <ChevronRight color={sheet.ink3} size={20} />
          </Pressable>
        ))}
        <View style={styles.footer}>
          <Button
            title={kind === 'income' ? 'New income category' : 'New spending category'}
            onPress={() => router.push({ pathname: '/category/[id]', params: { id: 'new', kind } })}
            background={sheet.btnBg}
            color={sheet.btnFg}
          />
        </View>

        <Text style={styles.section}>Backup</Text>
        <Text style={styles.hint}>Your data lives only on this phone. Export a backup to keep it safe, and import it to restore.</Text>
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
        {message !== '' && <Text style={styles.message}>{message}</Text>}

        <Text style={styles.section}>Danger zone</Text>
        <ActionRow
          Icon={Trash2}
          title="Delete all data"
          subtitle="Start again with an empty app"
          danger
          onPress={deleteEverything}
        />
      </ScrollView>
    </SafeAreaView>
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
  screen: { flex: 1, backgroundColor: sheet.bg, paddingHorizontal: spacing.xl },
  content: { paddingBottom: spacing.xxl },
  section: { color: sheet.ink2, fontSize: 14, fontWeight: '600', marginTop: 26, marginBottom: 8 },
  hint: { color: sheet.ink2, fontSize: 14, lineHeight: 20, marginBottom: 6 },
  message: { color: sheet.ink, fontSize: 14.5, fontWeight: '600', marginTop: 8 },
  segment: { flexDirection: 'row', backgroundColor: sheet.card, borderRadius: 22, padding: 3, gap: 3, marginBottom: 8 },
  segmentItem: { flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  segmentText: { color: sheet.ink2, fontSize: 14.5, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  main: { flex: 1 },
  rowTitle: { color: sheet.ink, fontSize: 16.5, fontWeight: '600' },
  rowSub: { color: sheet.ink2, fontSize: 13, fontWeight: '400' },
  actionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: sheet.card, alignItems: 'center', justifyContent: 'center' },
  currencyRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingLeft: 4 },
  currencySymbol: { color: sheet.ink, fontSize: 17, fontWeight: '700', width: 40, textAlign: 'center' },
  footer: { marginTop: spacing.md },
});
