'use client';

import { type JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { Archive, CalendarClock, ChevronDown, Clock3, Download, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

type BackupFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

type BackupSchedule = {
  frequency: BackupFrequency;
  runAtTime: string;
  runDayOfWeek: number | null;
  runDayOfMonth: number | null;
  runMonth: number | null;
  isActive: boolean;
  lastRunAt: string | null;
};

type BackupRecord = {
  completedAt?: string | null;
  filePath?: string | null;
  fileSizeBytes?: number | null;
  mode?: string | null;
  status?: string | null;
};

type BackupSettingsResponse = {
  schedule?: Partial<BackupSchedule>;
  latestBackup?: BackupRecord | null;
};

type BackupRunResponse = {
  backup?: BackupRecord;
};

const DEFAULT_SCHEDULE: BackupSchedule = {
  frequency: 'none',
  isActive: false,
  lastRunAt: null,
  runAtTime: '02:00',
  runDayOfMonth: 1,
  runDayOfWeek: 1,
  runMonth: 1,
};

const backupClient = new AxiosClient();

const mergeSchedule = (input: Partial<BackupSchedule> | undefined): BackupSchedule => ({
  ...DEFAULT_SCHEDULE,
  ...(input ?? {}),
});

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return '-';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
};

const formatBytes = (value?: number | null): string => {
  if (!value || value <= 0) {
    return '-';
  }

  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

const normalizeDayOfMonth = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.min(Math.max(Math.floor(parsed), 1), 31);
};

const normalizeMonth = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.min(Math.max(Math.floor(parsed), 1), 12);
};

export const InvoiceBackupDropdownPanel = (): JSX.Element => {
  const [schedule, setSchedule] = useState<BackupSchedule>(DEFAULT_SCHEDULE);
  const [latestBackup, setLatestBackup] = useState<BackupRecord | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [manualStartDate, setManualStartDate] = useState(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return start.toISOString().slice(0, 10);
  });
  const [manualEndDate, setManualEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const isWeekly = schedule.frequency === 'weekly';
  const isMonthly = schedule.frequency === 'monthly';
  const isYearly = schedule.frequency === 'yearly';
  const requiresDayOfMonth = isMonthly || isYearly;

  const scheduleLabel = useMemo(() => {
    if (schedule.frequency === 'none' || !schedule.isActive) {
      return 'Disabled';
    }
    return schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1);
  }, [schedule.frequency, schedule.isActive]);

  const fetchSettings = useCallback(async (): Promise<void> => {
    setIsFetching(true);
    try {
      const response = await backupClient.get<BackupSettingsResponse>(
        '/api/v1/dental-management/backups/settings'
      );
      if (!response.success || !response.data) {
        toast.error(response.error?.message ?? 'Failed to load backup settings.');
        return;
      }

      setSchedule(mergeSchedule(response.data.schedule));
      setLatestBackup(response.data.latestBackup ?? null);
    } catch {
      toast.error('Failed to load backup settings.');
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const persistSchedule = useCallback(async (nextSchedule: BackupSchedule): Promise<boolean> => {
    setIsSaving(true);
    try {
      await backupClient.get('/sanctum/csrf-cookie');
      const payload = {
        frequency: nextSchedule.frequency,
        isActive: nextSchedule.frequency === 'none' ? false : nextSchedule.isActive,
        runAtTime: nextSchedule.runAtTime,
        runDayOfMonth:
          nextSchedule.frequency === 'monthly' || nextSchedule.frequency === 'yearly'
            ? nextSchedule.runDayOfMonth
            : null,
        runDayOfWeek: nextSchedule.frequency === 'weekly' ? nextSchedule.runDayOfWeek : null,
        runMonth: nextSchedule.frequency === 'yearly' ? nextSchedule.runMonth : null,
      };

      const response = await backupClient.put<{ schedule?: Partial<BackupSchedule> }>(
        '/api/v1/dental-management/backups/settings',
        payload
      );

      if (!response.success || !response.data?.schedule) {
        toast.error(response.error?.message ?? 'Failed to save backup schedule.');
        return false;
      }

      setSchedule(mergeSchedule(response.data.schedule));
      toast.success('Backup schedule updated.');
      return true;
    } catch {
      toast.error('Failed to save backup schedule.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const runBackup = useCallback(
    async (mode: 'full' | 'date_range'): Promise<void> => {
      if (mode === 'date_range' && (!manualStartDate || !manualEndDate)) {
        toast.error('Please select both start and end dates.');
        return;
      }

      if (mode === 'date_range' && manualStartDate > manualEndDate) {
        toast.error('Start date cannot be after end date.');
        return;
      }

      setIsRunning(true);
      try {
        await backupClient.get('/sanctum/csrf-cookie');
        const payload =
          mode === 'date_range'
            ? { endDate: manualEndDate, mode, startDate: manualStartDate }
            : { mode };
        const response = await backupClient.post<BackupRunResponse>(
          '/api/v1/dental-management/backups/run',
          payload
        );
        if (!response.success) {
          toast.error(response.error?.message ?? 'Backup failed.');
          return;
        }

        const backup = response.data?.backup ?? null;
        setLatestBackup(backup);
        setSchedule((previous) => ({ ...previous, lastRunAt: backup?.completedAt ?? previous.lastRunAt }));
        toast.success('Backup completed successfully.');
      } catch {
        toast.error('Backup failed.');
      } finally {
        setIsRunning(false);
      }
    },
    [manualEndDate, manualStartDate]
  );

  const quickSetFrequency = useCallback(
    async (frequency: BackupFrequency): Promise<void> => {
      const nextSchedule: BackupSchedule = {
        ...schedule,
        frequency,
        isActive: frequency !== 'none',
        runAtTime: schedule.runAtTime || '02:00',
        runDayOfMonth:
          frequency === 'monthly' || frequency === 'yearly' ? schedule.runDayOfMonth ?? 1 : null,
        runDayOfWeek: frequency === 'weekly' ? schedule.runDayOfWeek ?? 1 : null,
        runMonth: frequency === 'yearly' ? schedule.runMonth ?? 1 : null,
      };
      setSchedule(nextSchedule);
      await persistSchedule(nextSchedule);
    },
    [persistSchedule, schedule]
  );

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Data Backup</CardTitle>
          <CardDescription>
            Create a full backup now, run manual date-range backups, or configure automatic schedules.
          </CardDescription>
        </div>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isFetching || isRunning || isSaving}>
                {isRunning || isFetching ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Archive className="mr-2 size-4" />}
                Backup Actions
                <ChevronDown className="ml-2 size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  void runBackup('full');
                }}
              >
                <Download className="size-4" />
                Run full backup now
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  void runBackup('date_range');
                }}
              >
                <CalendarClock className="size-4" />
                Run date-range backup
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Clock3 className="size-4" />
                  Quick auto schedule
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => void quickSetFrequency('daily')}>
                    Daily
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void quickSetFrequency('weekly')}>
                    Weekly
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void quickSetFrequency('monthly')}>
                    Monthly
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void quickSetFrequency('yearly')}>
                    Yearly
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void quickSetFrequency('none')}>
                    Disable auto backup
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="backup-frequency">Frequency</Label>
            <select
              id="backup-frequency"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={schedule.frequency}
              onChange={(event) => {
                const nextFrequency = event.target.value as BackupFrequency;
                setSchedule((previous) => ({
                  ...previous,
                  frequency: nextFrequency,
                  isActive: nextFrequency !== 'none',
                  runDayOfMonth:
                    nextFrequency === 'monthly' || nextFrequency === 'yearly'
                      ? previous.runDayOfMonth ?? 1
                      : null,
                  runDayOfWeek: nextFrequency === 'weekly' ? previous.runDayOfWeek ?? 1 : null,
                  runMonth: nextFrequency === 'yearly' ? previous.runMonth ?? 1 : null,
                }));
              }}
              disabled={isFetching || isSaving}
            >
              <option value="none">Disabled</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="backup-time">Run Time</Label>
            <Input
              id="backup-time"
              type="time"
              value={schedule.runAtTime}
              onChange={(event) => {
                setSchedule((previous) => ({ ...previous, runAtTime: event.target.value }));
              }}
              disabled={isFetching || isSaving}
            />
          </div>

          {isWeekly ? (
            <div className="space-y-1">
              <Label htmlFor="backup-weekday">Weekday</Label>
              <select
                id="backup-weekday"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={schedule.runDayOfWeek ?? 1}
                onChange={(event) => {
                  setSchedule((previous) => ({
                    ...previous,
                    runDayOfWeek: Number(event.target.value),
                  }));
                }}
                disabled={isFetching || isSaving}
              >
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
              </select>
            </div>
          ) : null}

          {requiresDayOfMonth ? (
            <div className="space-y-1">
              <Label htmlFor="backup-day-of-month">Day Of Month</Label>
              <Input
                id="backup-day-of-month"
                type="number"
                min={1}
                max={31}
                value={schedule.runDayOfMonth ?? 1}
                onChange={(event) => {
                  setSchedule((previous) => ({
                    ...previous,
                    runDayOfMonth: normalizeDayOfMonth(event.target.value),
                  }));
                }}
                disabled={isFetching || isSaving}
              />
            </div>
          ) : null}

          {isYearly ? (
            <div className="space-y-1">
              <Label htmlFor="backup-month">Month</Label>
              <Input
                id="backup-month"
                type="number"
                min={1}
                max={12}
                value={schedule.runMonth ?? 1}
                onChange={(event) => {
                  setSchedule((previous) => ({
                    ...previous,
                    runMonth: normalizeMonth(event.target.value),
                  }));
                }}
                disabled={isFetching || isSaving}
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
          <div className="space-y-0.5">
            <p>
              Auto backup: <span className="font-semibold">{scheduleLabel}</span>
            </p>
            <p className="text-muted-foreground">
              Last run: <span>{formatDateTime(schedule.lastRunAt)}</span>
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              void persistSchedule(schedule);
            }}
            disabled={isSaving || isFetching}
          >
            {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Save Schedule
          </Button>
        </div>

        <div className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="manual-start-date">Manual Start Date</Label>
            <Input
              id="manual-start-date"
              type="date"
              value={manualStartDate}
              onChange={(event) => {
                setManualStartDate(event.target.value);
              }}
              disabled={isRunning}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="manual-end-date">Manual End Date</Label>
            <Input
              id="manual-end-date"
              type="date"
              value={manualEndDate}
              onChange={(event) => {
                setManualEndDate(event.target.value);
              }}
              disabled={isRunning}
            />
          </div>
          <div className="flex items-end md:col-span-2">
            <Button
              size="sm"
              onClick={() => {
                void runBackup('date_range');
              }}
              disabled={isRunning || !manualStartDate || !manualEndDate}
            >
              {isRunning ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CalendarClock className="mr-2 size-4" />}
              Run Date-Range Backup
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-dashed p-3 text-sm">
          <p className="font-semibold">Latest Backup</p>
          <p className="text-muted-foreground">Status: {latestBackup?.status ?? '-'}</p>
          <p className="text-muted-foreground">Mode: {latestBackup?.mode ?? '-'}</p>
          <p className="text-muted-foreground">Completed: {formatDateTime(latestBackup?.completedAt)}</p>
          <p className="text-muted-foreground">Size: {formatBytes(latestBackup?.fileSizeBytes)}</p>
          <p className="truncate text-muted-foreground">File: {latestBackup?.filePath ?? '-'}</p>
        </div>
      </CardContent>
    </Card>
  );
};
