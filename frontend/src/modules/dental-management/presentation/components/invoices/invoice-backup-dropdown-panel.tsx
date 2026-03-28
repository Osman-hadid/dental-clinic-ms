'use client';

import { type JSX, useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { Archive, Clock3, HardDrive, Loader2, ShieldAlert, ShieldCheck, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';

type BackupFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
type BackupSchedule = { frequency: BackupFrequency; isActive: boolean; lastRunAt: string | null; runAtTime: string; runDayOfMonth: number | null; runDayOfWeek: number | null; runMonth: number | null };
type BackupRecord = { completedAt?: string | null; createdAt?: string | null; fileSizeBytes?: number | null; id?: number | null; mode?: string | null; notes?: string | null; status?: string | null };
type HealthCheck = { action: string; details: string; label: string; status: 'critical' | 'ok' | 'warning'; value: string };
type HealthSummary = { backupStorageBytes: number; criticalDiskWarning: boolean; diskFreeBytes: number; diskFreePercent: number; diskTotalBytes: number; failedBackupCount: number; healthWarningCount: number; lastSuccessfulBackupAt: string | null; lastSuccessfulBackupId: number | null; latestBackupStatus: string; latestFailureMessage: string | null; lowDiskWarning: boolean; nextScheduledRunAt: string | null; status: 'critical' | 'ok' | 'warning' };
type HealthPayload = { checks: HealthCheck[]; recentBackups: BackupRecord[]; summary: HealthSummary };
type SettingsResponse = { health?: HealthPayload; lastSuccessfulBackup?: BackupRecord | null; latestBackup?: BackupRecord | null; recentBackups?: BackupRecord[]; schedule?: Partial<BackupSchedule> };
type RestoreReadiness = { checkedAt: string; checks: Array<{ details: string; label: string; status: string; value: string }>; fileExists: boolean; fileSizeBytes: number; restorable: boolean; rowCountEstimate: number; status: string; tableCount: number };
type RestoreReadinessResponse = { readiness?: RestoreReadiness };
type WorkflowAccessSummary = { capabilities: { canManageBackupSettings: boolean; canRunBackups: boolean; canViewBackups: boolean }; user: { rightLevel: string } };

const client = new AxiosClient();
const DEFAULT_SCHEDULE: BackupSchedule = { frequency: 'none', isActive: false, lastRunAt: null, runAtTime: '02:00', runDayOfMonth: 1, runDayOfWeek: 1, runMonth: 1 };
const EMPTY_HEALTH: HealthPayload = { checks: [], recentBackups: [], summary: { backupStorageBytes: 0, criticalDiskWarning: false, diskFreeBytes: 0, diskFreePercent: 0, diskTotalBytes: 0, failedBackupCount: 0, healthWarningCount: 0, lastSuccessfulBackupAt: null, lastSuccessfulBackupId: null, latestBackupStatus: 'not_available', latestFailureMessage: null, lowDiskWarning: false, nextScheduledRunAt: null, status: 'warning' } };

const mergeSchedule = (value?: Partial<BackupSchedule>): BackupSchedule => ({ ...DEFAULT_SCHEDULE, ...(value ?? {}) });
const formatDateTime = (value?: string | null): string => !value ? '-' : (Number.isNaN(new Date(value).getTime()) ? value : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)));
const formatBytes = (value?: number | null): string => !value || value <= 0 ? '-' : value < 1024 ? `${value} B` : value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KB` : value < 1024 * 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(2)} MB` : `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
const badgeClassName = (status: string): string => status === 'ok' || status === 'completed' ? 'bg-emerald-600 text-white' : status === 'warning' || status === 'running' ? 'bg-amber-500 text-white' : status === 'critical' || status === 'failed' ? 'bg-rose-600 text-white' : 'bg-slate-600 text-white';

export const InvoiceBackupDropdownPanel = (): JSX.Element => {
  const [schedule, setSchedule] = useState<BackupSchedule>(DEFAULT_SCHEDULE);
  const [health, setHealth] = useState<HealthPayload>(EMPTY_HEALTH);
  const [recentBackups, setRecentBackups] = useState<BackupRecord[]>([]);
  const [latestBackup, setLatestBackup] = useState<BackupRecord | null>(null);
  const [lastSuccessfulBackup, setLastSuccessfulBackup] = useState<BackupRecord | null>(null);
  const [selectedBackupId, setSelectedBackupId] = useState('');
  const [readiness, setReadiness] = useState<RestoreReadiness | null>(null);
  const [manualStartDate, setManualStartDate] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [manualEndDate, setManualEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isCheckingReadiness, setIsCheckingReadiness] = useState(false);
  const [workflowAccess, setWorkflowAccess] = useState<WorkflowAccessSummary | null>(null);

  const loadSettings = useCallback(async (): Promise<void> => {
    setIsFetching(true);
    try {
      const response = await client.get<SettingsResponse>('/api/v1/dental-management/backups/settings');
      if (!response.success || !response.data) {
        toast.error(response.error?.message ?? 'Failed to load backup settings.');
        return;
      }
      const data = response.data;
      setSchedule(mergeSchedule(data.schedule));
      setHealth(data.health ?? EMPTY_HEALTH);
      setRecentBackups(data.recentBackups ?? data.health?.recentBackups ?? []);
      setLatestBackup(data.latestBackup ?? null);
      setLastSuccessfulBackup(data.lastSuccessfulBackup ?? null);
      setSelectedBackupId((current) => current || String(data.lastSuccessfulBackup?.id ?? data.recentBackups?.[0]?.id ?? ''));
    } catch {
      toast.error('Failed to load backup settings.');
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  useEffect(() => {
    void client.get<WorkflowAccessSummary>('/api/v1/dental-management/workflow/access-summary')
      .then((response) => {
        if (response.success && response.data) {
          setWorkflowAccess(response.data);
        }
      })
      .catch(() => {
        setWorkflowAccess(null);
      });
  }, []);

  const saveSchedule = useCallback(async (): Promise<void> => {
    if (!workflowAccess?.capabilities.canManageBackupSettings) {
      toast.error('Approval access is required to update backup settings.');
      return;
    }
    setIsSaving(true);
    try {
      await client.get('/sanctum/csrf-cookie');
      const response = await client.put<SettingsResponse>('/api/v1/dental-management/backups/settings', {
        frequency: schedule.frequency,
        isActive: schedule.frequency === 'none' ? false : schedule.isActive,
        runAtTime: schedule.runAtTime,
        runDayOfMonth: schedule.frequency === 'monthly' || schedule.frequency === 'yearly' ? schedule.runDayOfMonth : null,
        runDayOfWeek: schedule.frequency === 'weekly' ? schedule.runDayOfWeek : null,
        runMonth: schedule.frequency === 'yearly' ? schedule.runMonth : null,
      });
      if (!response.success) {
        toast.error(response.error?.message ?? 'Failed to save backup schedule.');
        return;
      }
      toast.success('Backup schedule updated.');
      await loadSettings();
    } catch {
      toast.error('Failed to save backup schedule.');
    } finally {
      setIsSaving(false);
    }
  }, [loadSettings, schedule, workflowAccess]);

  const runBackup = useCallback(async (mode: 'date_range' | 'full'): Promise<void> => {
    if (!workflowAccess?.capabilities.canRunBackups) {
      toast.error('Review or approval access is required to run backups.');
      return;
    }
    if (mode === 'date_range' && (!manualStartDate || !manualEndDate || manualStartDate > manualEndDate)) {
      toast.error('Choose a valid backup date range.');
      return;
    }
    setIsRunning(true);
    try {
      await client.get('/sanctum/csrf-cookie');
      const response = await client.post('/api/v1/dental-management/backups/run', mode === 'full' ? { mode } : { mode, startDate: manualStartDate, endDate: manualEndDate });
      if (!response.success) {
        toast.error(response.error?.message ?? 'Backup failed.');
        return;
      }
      toast.success('Backup completed successfully.');
      await loadSettings();
    } catch {
      toast.error('Backup failed.');
    } finally {
      setIsRunning(false);
    }
  }, [loadSettings, manualEndDate, manualStartDate, workflowAccess]);

  const checkRestoreReadiness = useCallback(async (): Promise<void> => {
    if (!selectedBackupId) {
      toast.error('Select a backup first.');
      return;
    }
    setIsCheckingReadiness(true);
    try {
      const response = await client.get<RestoreReadinessResponse>(`/api/v1/dental-management/backups/${selectedBackupId}/restore-readiness`);
      if (!response.success || !response.data?.readiness) {
        toast.error(response.error?.message ?? 'Failed to check restore readiness.');
        return;
      }
      setReadiness(response.data.readiness);
      toast.success('Restore readiness checked.');
    } catch {
      toast.error('Failed to check restore readiness.');
    } finally {
      setIsCheckingReadiness(false);
    }
  }, [selectedBackupId]);

  const HealthIcon = health.summary.status === 'critical' ? ShieldAlert : ShieldCheck;

  return (
    <div className="space-y-6">
      <Card className={health.summary.status === 'critical' ? 'border-rose-300 bg-rose-50' : health.summary.status === 'warning' ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HealthIcon className="size-5" />Backup And System Health</CardTitle>
          <CardDescription>Monitor backups, storage pressure, and restore readiness from one page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {workflowAccess && !workflowAccess.capabilities.canManageBackupSettings ? <div className="rounded-2xl border border-amber-300 bg-white/80 p-4 text-sm">You can review backup history with `{workflowAccess.user.rightLevel}` rights, but changing backup schedules requires `approval` access.</div> : null}
          {(health.summary.lowDiskWarning || health.summary.criticalDiskWarning || health.summary.failedBackupCount > 0) ? <div className="rounded-2xl border border-amber-300 bg-white/80 p-4 text-sm">Latest alert: {health.summary.latestFailureMessage || `Disk free space is ${health.summary.diskFreePercent}%.`}</div> : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-2xl border bg-background p-4"><p className="text-xs text-muted-foreground">Health</p><p className="mt-2 text-2xl font-semibold capitalize">{health.summary.status}</p></div>
            <div className="rounded-2xl border bg-background p-4"><p className="text-xs text-muted-foreground">Last Success</p><p className="mt-2 text-sm font-semibold">{formatDateTime(lastSuccessfulBackup?.completedAt ?? health.summary.lastSuccessfulBackupAt)}</p></div>
            <div className="rounded-2xl border bg-background p-4"><p className="text-xs text-muted-foreground">Latest Backup</p><div className="mt-2"><Badge className={badgeClassName(health.summary.latestBackupStatus)}>{health.summary.latestBackupStatus}</Badge></div></div>
            <div className="rounded-2xl border bg-background p-4"><p className="text-xs text-muted-foreground">Failed (7d)</p><p className="mt-2 text-2xl font-semibold">{health.summary.failedBackupCount}</p></div>
            <div className="rounded-2xl border bg-background p-4"><p className="text-xs text-muted-foreground">Free Disk</p><p className="mt-2 text-2xl font-semibold">{health.summary.diskFreePercent}%</p><p className="mt-1 text-xs text-muted-foreground">{formatBytes(health.summary.diskFreeBytes)}</p></div>
            <div className="rounded-2xl border bg-background p-4"><p className="text-xs text-muted-foreground">Backup Storage</p><p className="mt-2 text-2xl font-semibold">{formatBytes(health.summary.backupStorageBytes)}</p><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(health.summary.nextScheduledRunAt)}</p></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader><CardTitle>Backup Controls</CardTitle><CardDescription>Schedule automatic backups and run manual ones when needed.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1"><Label htmlFor="backup-frequency">Frequency</Label><select id="backup-frequency" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={schedule.frequency} onChange={(event) => setSchedule((previous) => ({ ...previous, frequency: event.target.value as BackupFrequency, isActive: event.target.value !== 'none' }))}><option value="none">Disabled</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
              <div className="space-y-1"><Label htmlFor="backup-time">Run Time</Label><Input id="backup-time" type="time" value={schedule.runAtTime} onChange={(event) => setSchedule((previous) => ({ ...previous, runAtTime: event.target.value }))} /></div>
              <div className="space-y-1"><Label htmlFor="backup-start">Manual Start</Label><Input id="backup-start" type="date" value={manualStartDate} onChange={(event) => setManualStartDate(event.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="backup-end">Manual End</Label><Input id="backup-end" type="date" value={manualEndDate} onChange={(event) => setManualEndDate(event.target.value)} /></div>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">Current schedule: {schedule.frequency === 'none' || !schedule.isActive ? 'Disabled' : `${schedule.frequency} at ${schedule.runAtTime}`}. Last run: {formatDateTime(schedule.lastRunAt)}.</div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={isSaving || !workflowAccess?.capabilities.canManageBackupSettings} onClick={() => void saveSchedule()}>{isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Clock3 className="mr-2 size-4" />}Save Schedule</Button>
              <Button type="button" variant="outline" disabled={isRunning || !workflowAccess?.capabilities.canRunBackups} onClick={() => void runBackup('full')}>{isRunning ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Archive className="mr-2 size-4" />}Run Full Backup</Button>
              <Button type="button" variant="outline" disabled={isRunning || !workflowAccess?.capabilities.canRunBackups} onClick={() => void runBackup('date_range')}><Archive className="mr-2 size-4" />Run Date Range Backup</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Restore Readiness</CardTitle><CardDescription>Validate that a backup file is present and usable before recovery is needed.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1"><Label htmlFor="backup-restore-id">Backup</Label><select id="backup-restore-id" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={selectedBackupId} onChange={(event) => setSelectedBackupId(event.target.value)}><option value="">Select a backup</option>{recentBackups.map((backup) => <option key={backup.id ?? `${backup.createdAt}-${backup.status}`} value={String(backup.id ?? '')}>{`${formatDateTime(backup.completedAt ?? backup.createdAt)} | ${backup.mode ?? 'backup'} | ${backup.status ?? 'unknown'}`}</option>)}</select></div>
            <Button type="button" disabled={!selectedBackupId || isCheckingReadiness} onClick={() => void checkRestoreReadiness()}>{isCheckingReadiness ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Stethoscope className="mr-2 size-4" />}Check Restore Readiness</Button>
            {readiness ? <div className="space-y-3 rounded-2xl border bg-muted/20 p-4"><div className="flex items-center gap-2"><Badge className={badgeClassName(readiness.status)}>{readiness.status}</Badge><span className="text-sm text-muted-foreground">{formatDateTime(readiness.checkedAt)}</span></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border bg-background p-3"><p className="text-xs text-muted-foreground">Backup file</p><p className="mt-1 font-semibold">{readiness.fileExists ? 'Available' : 'Missing'}</p><p className="text-xs text-muted-foreground">{formatBytes(readiness.fileSizeBytes)}</p></div><div className="rounded-xl border bg-background p-3"><p className="text-xs text-muted-foreground">Restore summary</p><p className="mt-1 font-semibold">{readiness.tableCount} tables</p><p className="text-xs text-muted-foreground">{readiness.rowCountEstimate} rows estimated</p></div></div></div> : <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Choose a backup to run a non-destructive restore readiness check.</div>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent Backup Runs</CardTitle><CardDescription>Latest completed and failed backup attempts.</CardDescription></CardHeader>
          <CardContent><div className="overflow-x-auto rounded-2xl border"><table className="min-w-full text-sm"><thead className="bg-muted/30 text-left text-muted-foreground"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Mode</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Size</th><th className="px-3 py-2">Notes</th></tr></thead><tbody>{recentBackups.length > 0 ? recentBackups.map((backup) => <tr key={backup.id ?? `${backup.createdAt}-${backup.status}`} className="border-t"><td className="px-3 py-2">{formatDateTime(backup.completedAt ?? backup.createdAt)}</td><td className="px-3 py-2">{backup.mode ?? '-'}</td><td className="px-3 py-2"><Badge className={badgeClassName(backup.status ?? 'unknown')}>{backup.status ?? 'unknown'}</Badge></td><td className="px-3 py-2">{formatBytes(backup.fileSizeBytes)}</td><td className="px-3 py-2">{backup.notes || '-'}</td></tr>) : <tr className="border-t"><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No backup runs were found yet.</td></tr>}</tbody></table></div></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>System Health Checks</CardTitle><CardDescription>Database, storage, public link, and backup readiness checks.</CardDescription></CardHeader>
          <CardContent className="space-y-4"><div className="overflow-x-auto rounded-2xl border"><table className="min-w-full text-sm"><thead className="bg-muted/30 text-left text-muted-foreground"><tr><th className="px-3 py-2">Check</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Action</th></tr></thead><tbody>{health.checks.length > 0 ? health.checks.map((row, index) => <tr key={`${row.label}-${index}`} className="border-t"><td className="px-3 py-2"><div className="space-y-1"><p>{row.label}</p><p className="text-xs text-muted-foreground">{row.details}</p></div></td><td className="px-3 py-2"><Badge className={badgeClassName(row.status)}>{row.status}</Badge></td><td className="px-3 py-2">{row.value}</td><td className="px-3 py-2">{row.action}</td></tr>) : <tr className="border-t"><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No health checks were returned.</td></tr>}</tbody></table></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border bg-muted/20 p-4"><p className="flex items-center gap-2 text-sm font-semibold"><HardDrive className="size-4" />Disk overview</p><p className="mt-2 text-sm text-muted-foreground">Free: {formatBytes(health.summary.diskFreeBytes)} / Total: {formatBytes(health.summary.diskTotalBytes)}</p></div><div className="rounded-2xl border bg-muted/20 p-4"><p className="flex items-center gap-2 text-sm font-semibold"><Archive className="size-4" />Latest backup</p><p className="mt-2 text-sm text-muted-foreground">{latestBackup?.status ? `${latestBackup.status} at ${formatDateTime(latestBackup.completedAt)}` : 'No backup history yet.'}</p></div></div></CardContent>
        </Card>
      </div>
    </div>
  );
};
