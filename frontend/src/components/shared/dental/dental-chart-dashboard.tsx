'use client';

import { useMemo, useRef, useState, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatCurrency as formatMoney } from '@/lib/currency-utils';
import { getIntlLocale } from '@/modules/common/utils/locale';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  CircleCheck,
  Clock3,
  Search,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ClinicSpatialHome, type SpatialPanel } from './clinic-spatial-home';
import styles from './clinic-workspace.module.css';

export type RevenueRange = '7d' | '30d' | '90d';

type ScheduleEvent = {
  dateKey: string;
  dentistName: string;
  key: string;
  linkedVisitId: number | string | null;
  note: string;
  patientId: number | string | null;
  patientName: string;
  status: string;
  tag: string;
  timeLabel: string;
  title: string;
  type: 'appointment' | 'visit';
  timestamp: number;
};

export type DashboardOverview = {
  schedule: {
    todayKey: string;
    todayVisits: number;
    todayAppointments: number;
    eventsByDate: Record<string, ScheduleEvent[]>;
    upcomingEvents: ScheduleEvent[];
  };
  patients: { total: number; new30d: number; returning: number };
  performance: { completionRate: number; calendarCoverageDays: number };
  operations: {
    diskFreePercent: number;
    failedBackupCount: number;
    healthWarningCount: number;
    lastSuccessfulBackupAt: string | null;
    status: string;
  };
  charts: {
    revenueRange: RevenueRange;
    revenueSeries: Array<{ date: string; billed: number; paid: number }>;
    appointmentMix: { scheduled: number; completed: number; cancelled: number };
  };
  safe: {
    balance: number;
    currencySections?: Record<
      'AFN' | 'USD',
      { balance: number; totalIn: number; totalOut: number }
    >;
    totalIn: number;
    totalOut: number;
    afnPerUsd: number;
  };
  radialSafeSummary: { debtOutstanding: number; supplierUnpaids: number } | null;
};

type DentalChartDashboardProps = {
  firstName?: string;
  hasError?: boolean;
  isLoading?: boolean;
  locale: string;
  onRetry?: () => void;
  onRevenueRangeChange?: (range: RevenueRange) => void;
  overview: DashboardOverview | null;
  revenueRange?: RevenueRange;
};

const normalizeStatus = (status: string): string =>
  status.trim().toLowerCase().replace(/\s+/g, '_');

const isOpenEvent = (event: ScheduleEvent): boolean =>
  !['completed', 'done', 'cancelled', 'canceled', 'rejected'].includes(
    normalizeStatus(event.status)
  );

const statusTone = (status: string): string => {
  const value = normalizeStatus(status);
  if (['completed', 'done'].includes(value)) return styles.statusCompleted;
  if (['cancelled', 'canceled', 'rejected'].includes(value)) return styles.statusCancelled;
  if (['waiting', 'checked_in', 'in_chair', 'in_progress', 'ongoing'].includes(value)) {
    return styles.statusWaiting;
  }
  return styles.statusScheduled;
};

const formatDay = (date: string, locale: string, full = false): string => {
  const parsed = new Date(date + 'T12:00:00');
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(
    getIntlLocale(locale),
    full ? { day: 'numeric', month: 'long', weekday: 'short' } : { day: 'numeric', month: 'short' }
  ).format(parsed);
};

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();

export const DentalChartDashboard = ({
  firstName,
  hasError = false,
  isLoading = false,
  locale,
  onRetry,
  onRevenueRangeChange,
  overview,
  revenueRange,
}: DentalChartDashboardProps): JSX.Element => {
  const router = useRouter();
  const t = useTranslations('dashboard');
  const isRtl = locale === 'dr' || locale === 'ps';
  const [searchTerm, setSearchTerm] = useState('');
  const [activePanel, setActivePanel] = useState<SpatialPanel>('today');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const panelTriggerRef = useRef<HTMLElement | null>(null);
  const openPanel = (panel: SpatialPanel): void => {
    panelTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActivePanel(panel);
    setIsPanelOpen(true);
  };
  const allTodayEvents = useMemo(
    () =>
      [...(overview?.schedule.eventsByDate[overview.schedule.todayKey] ?? [])].sort(
        (left, right) => left.timestamp - right.timestamp
      ),
    [overview]
  );
  const todayEvents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return query
      ? allTodayEvents.filter((event) =>
          [event.patientName, event.dentistName, event.status, event.tag]
            .join(' ')
            .toLowerCase()
            .includes(query)
        )
      : allTodayEvents;
  }, [allTodayEvents, searchTerm]);
  const queue = useMemo(() => allTodayEvents.filter(isOpenEvent), [allTodayEvents]);
  const upcomingEvents = useMemo(
    () =>
      [...(overview?.schedule.upcomingEvents ?? [])]
        .filter(isOpenEvent)
        .sort((left, right) => left.timestamp - right.timestamp)
        .slice(0, 3),
    [overview]
  );
  const num = new Intl.NumberFormat(getIntlLocale(locale));
  const money = (value: number, currency: 'AFN' | 'USD' = 'AFN'): string =>
    formatMoney(Math.round(value * 100) / 100, currency);
  const navigate = (destination: string): void => {
    router.push('/' + locale + '/dental-management/' + destination);
  };
  const openEvent = (event: ScheduleEvent): void => {
    if (event.linkedVisitId !== null) {
      navigate('visits/chart?visitId=' + encodeURIComponent(String(event.linkedVisitId)));
      return;
    }
    navigate(event.type === 'appointment' ? 'appointments' : 'visits');
  };
  const statusLabel = (status: string): string => {
    const key = 'statuses.' + normalizeStatus(status);
    return t.has(key)
      ? t(key)
      : status
          .split(/[_\s]+/)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
  };

  const spatialHome = (
    <ClinicSpatialHome
      firstName={firstName}
      hasError={hasError}
      isLoading={isLoading}
      locale={locale}
      onNavigate={navigate}
      onOpenPanel={openPanel}
      onRetry={onRetry}
      overview={overview}
    />
  );
  if (!overview) return spatialHome;

  const revenue = overview.charts.revenueSeries;
  const billed = revenue.reduce((total, item) => total + Number(item.billed || 0), 0);
  const paid = revenue.reduce((total, item) => total + Number(item.paid || 0), 0);
  const pending = Math.max(0, billed - paid);
  const activeRange = revenueRange ?? overview.charts.revenueRange;
  const days = Number(overview.charts.revenueRange.replace('d', ''));
  const mix = overview.charts.appointmentMix;
  const appointmentTotal = mix.scheduled + mix.completed + mix.cancelled;
  const scheduledAngle = appointmentTotal ? (mix.scheduled / appointmentTotal) * 360 : 0;
  const completedAngle = appointmentTotal
    ? ((mix.scheduled + mix.completed) / appointmentTotal) * 360
    : 0;
  const hasWarnings =
    overview.operations.healthWarningCount > 0 ||
    overview.operations.failedBackupCount > 0 ||
    ['warning', 'critical', 'degraded'].includes(overview.operations.status.toLowerCase());
  const lastBackup = overview.operations.lastSuccessfulBackupAt;
  const parsedBackup = lastBackup ? new Date(lastBackup) : null;
  const backupLabel =
    parsedBackup && !Number.isNaN(parsedBackup.getTime())
      ? t('lastBackup', {
          date: new Intl.DateTimeFormat(getIntlLocale(locale), { dateStyle: 'medium' }).format(
            parsedBackup
          ),
        })
      : t('noBackup');
  const safe = overview.safe.currencySections?.AFN ?? overview.safe;
  const usd = overview.safe.currencySections?.USD;

  return (
    <>
      {spatialHome}
      <Sheet open={isPanelOpen} onOpenChange={setIsPanelOpen}>
        <SheetContent
          className={styles.detailSheet}
          dir={isRtl ? 'rtl' : 'ltr'}
          side={isRtl ? 'left' : 'right'}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            panelTriggerRef.current?.focus();
          }}
        >
          <SheetHeader className={styles.detailHeader}>
            <div>
              <p className={styles.detailEyebrow}>SOURIRE / {t('spatial.atlas')}</p>
              <SheetTitle className={styles.detailTitle}>
                {t(activePanel === 'finances' ? 'spatial.finances' : 'spatial.dailyBrief')}
              </SheetTitle>
              <SheetDescription>
                {t(
                  activePanel === 'finances'
                    ? 'spatial.financesDescription'
                    : 'spatial.briefingDescription'
                )}
              </SheetDescription>
            </div>
            <SheetClose
              className={styles.detailClose}
              aria-label={t('spatial.close')}
              title={t('spatial.close')}
            >
              <X size={18} aria-hidden="true" />
            </SheetClose>
          </SheetHeader>
          <div className={styles.workspace + ' ' + styles.detailWorkspace}>
            {activePanel === 'today' ? (
              <>
                <section className={styles.metrics} aria-label={t('eyebrow')}>
                  <MetricCard
                    icon={CalendarClock}
                    label={t('todayAppointments')}
                    value={num.format(overview.schedule.todayAppointments)}
                    detail={t('registeredVisits', {
                      count: num.format(overview.schedule.todayVisits),
                    })}
                    tone="teal"
                  />
                  <MetricCard
                    icon={Clock3}
                    label={t('openItems')}
                    value={num.format(queue.length)}
                    detail={t('openItemsDescription')}
                    tone="amber"
                  />
                  <MetricCard
                    icon={CircleCheck}
                    label={t('completion')}
                    value={num.format(overview.performance.completionRate) + '%'}
                    detail={t('periodDays', { days: num.format(days) })}
                    tone="violet"
                  />
                  <MetricCard
                    icon={UsersRound}
                    label={t('newPatients')}
                    value={num.format(overview.patients.new30d)}
                    detail={t('newPatientsDescription')}
                    tone="sky"
                  />
                </section>
                <section className={styles.panel} aria-labelledby="today-schedule-title">
                  <div className={styles.panelHeading}>
                    <div>
                      <h2 id="today-schedule-title">
                        {t('schedule')}
                        <span className={styles.countPill}>
                          {num.format(allTodayEvents.length)}
                        </span>
                      </h2>
                      <p>{t('scheduleDescription')}</p>
                    </div>
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() => navigate('queue')}
                    >
                      {t('openWaitingRoom')}
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  </div>
                  <div className={styles.scheduleToolbar}>
                    <span className={styles.todayPill}>
                      <span />
                      {t('today')} · {formatDay(overview.schedule.todayKey, locale)}
                    </span>
                    <div className={styles.search}>
                      <Search size={15} aria-hidden="true" />
                      <Input
                        aria-label={t('searchPatients')}
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder={t('searchPatients')}
                      />
                    </div>
                  </div>
                  <div className={styles.scheduleList}>
                    {todayEvents.slice(0, 5).map((event) => (
                      <button
                        type="button"
                        key={event.key}
                        onClick={() => openEvent(event)}
                        className={styles.scheduleRow}
                      >
                        <span className={styles.eventTime}>{event.timeLabel || '—'}</span>
                        <span className={styles.patientAvatar}>
                          {initials(event.patientName) || (
                            <UsersRound size={16} aria-hidden="true" />
                          )}
                        </span>
                        <span className={styles.eventInfo}>
                          <strong>{event.patientName || event.title || t('unnamedPatient')}</strong>
                          <small>{event.dentistName || event.tag || t('clinicAppointment')}</small>
                        </span>
                        <span className={styles.statusPill + ' ' + statusTone(event.status)}>
                          <span />
                          {statusLabel(event.status)}
                        </span>
                        <ChevronRight size={16} className={styles.eventArrow} aria-hidden="true" />
                      </button>
                    ))}
                    {todayEvents.length === 0 ? (
                      <EmptyState
                        icon={CalendarClock}
                        title={t(searchTerm ? 'noMatches' : 'noSchedule')}
                        description={t(
                          searchTerm ? 'noMatchesDescription' : 'noScheduleDescription'
                        )}
                      />
                    ) : null}
                  </div>
                  <div className={styles.panelFooter}>
                    <span>
                      {t('totalPatients', { count: num.format(overview.patients.total) })}
                    </span>
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() => navigate('appointments')}
                    >
                      {t('fullSchedule')}
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </button>
                  </div>
                </section>
                <section className={styles.panel} aria-labelledby="appointment-activity-title">
                  <div className={styles.panelHeading}>
                    <div>
                      <h2 id="appointment-activity-title">{t('activity')}</h2>
                      <p>{t('periodDays', { days: num.format(days) })}</p>
                    </div>
                  </div>
                  <div className={styles.activityBody}>
                    <div
                      className={styles.activityRing}
                      style={{
                        background: appointmentTotal
                          ? 'conic-gradient(var(--home-scheduled) 0deg ' +
                            scheduledAngle +
                            'deg, var(--primary) ' +
                            scheduledAngle +
                            'deg ' +
                            completedAngle +
                            'deg, var(--home-cancelled) ' +
                            completedAngle +
                            'deg 360deg)'
                          : 'var(--muted)',
                      }}
                      role="img"
                      aria-label={num.format(appointmentTotal) + ' ' + t('appointments')}
                    >
                      <div>
                        <strong>{num.format(appointmentTotal)}</strong>
                        <span>{t('appointments')}</span>
                      </div>
                    </div>
                    <div className={styles.activityLegend}>
                      {[
                        {
                          color: 'var(--home-scheduled)',
                          label: t('scheduled'),
                          value: mix.scheduled,
                        },
                        { color: 'var(--primary)', label: t('completed'), value: mix.completed },
                        {
                          color: 'var(--home-cancelled)',
                          label: t('cancelled'),
                          value: mix.cancelled,
                        },
                      ].map(({ color, label, value }) => (
                        <div key={label}>
                          <i style={{ background: color }} />
                          <span>{label}</span>
                          <strong>{num.format(value)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
                <section className={styles.panel} aria-labelledby="upcoming-title">
                  <div className={styles.panelHeading}>
                    <div>
                      <h2 id="upcoming-title">{t('comingUp')}</h2>
                      <p>{t('comingUpDescription')}</p>
                    </div>
                    <CalendarDays size={18} className={styles.panelIcon} aria-hidden="true" />
                  </div>
                  <div className={styles.upcomingList}>
                    {upcomingEvents.map((event) => (
                      <button
                        type="button"
                        key={event.key}
                        onClick={() => openEvent(event)}
                        className={styles.upcomingEvent}
                      >
                        <span className={styles.upcomingIcon}>
                          <CalendarClock size={18} aria-hidden="true" />
                        </span>
                        <span className={styles.eventInfo}>
                          <strong>{event.patientName || event.title || t('unnamedPatient')}</strong>
                          <small>
                            {formatDay(event.dateKey, locale)} ·{' '}
                            {event.timeLabel || t('timeNotSet')}
                          </small>
                        </span>
                        <ChevronRight size={15} className={styles.eventArrow} aria-hidden="true" />
                      </button>
                    ))}
                    {upcomingEvents.length === 0 ? (
                      <EmptyState
                        icon={CalendarDays}
                        title={t('noUpcoming')}
                        description={t('noUpcomingDescription')}
                      />
                    ) : null}
                  </div>
                </section>
                <div
                  className={styles.systemStrip + (hasWarnings ? ' ' + styles.systemWarning : '')}
                >
                  <span className={styles.systemIcon}>
                    {hasWarnings ? (
                      <TriangleAlert size={19} aria-hidden="true" />
                    ) : (
                      <ShieldCheck size={19} aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <strong>{t(hasWarnings ? 'systemAttention' : 'systemHealthy')}</strong>
                    <p>
                      {hasWarnings
                        ? t('systemWarnings', {
                            backups: num.format(overview.operations.failedBackupCount),
                            warnings: num.format(overview.operations.healthWarningCount),
                          })
                        : backupLabel}
                    </p>
                  </div>
                  {!hasWarnings ? <Check size={16} aria-hidden="true" /> : null}
                </div>
              </>
            ) : (
              <>
                <section
                  className={styles.panel + ' ' + styles.revenuePanel}
                  aria-labelledby="revenue-title"
                  aria-busy={isLoading}
                >
                  <div className={styles.panelHeading}>
                    <div>
                      <h2 id="revenue-title">{t('revenue')}</h2>
                      <p>{t('revenueDescription')}</p>
                    </div>
                    <div className={styles.rangeControl} aria-label={t('revenue')}>
                      {(['7d', '30d', '90d'] as RevenueRange[]).map((range) => (
                        <button
                          type="button"
                          key={range}
                          onClick={() => onRevenueRangeChange?.(range)}
                          aria-pressed={activeRange === range}
                          disabled={isLoading}
                          data-active={activeRange === range}
                        >
                          {t('revenueDays', { days: num.format(Number(range.replace('d', ''))) })}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.revenueTotals}>
                    <div>
                      <span>
                        <i className={styles.billedDot} />
                        {t('billed')}
                      </span>
                      <strong>{money(billed)}</strong>
                    </div>
                    <div>
                      <span>
                        <i className={styles.collectedDot} />
                        {t('collected')}
                      </span>
                      <strong className={styles.collectedAmount}>{money(paid)}</strong>
                    </div>
                    <div>
                      <span>{t('uncollected')}</span>
                      <strong>{money(pending)}</strong>
                    </div>
                  </div>
                  <div className={styles.chart}>
                    {revenue.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={revenue}
                          margin={{ bottom: 0, left: 0, right: 8, top: 12 }}
                        >
                          <defs>
                            <linearGradient id="homeCollectedRevenue" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
                              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.01} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            vertical={false}
                            strokeDasharray="3 5"
                            stroke="var(--border)"
                          />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value) => formatDay(String(value), locale)}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                            minTickGap={35}
                            dy={8}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                            tickFormatter={(value) =>
                              new Intl.NumberFormat(getIntlLocale(locale), {
                                notation: 'compact',
                              }).format(Number(value))
                            }
                            width={45}
                          />
                          <Tooltip
                            formatter={(value) => money(Number(value))}
                            labelFormatter={(value) => formatDay(String(value), locale)}
                            contentStyle={{
                              background: 'var(--card)',
                              borderColor: 'var(--border)',
                              borderRadius: 12,
                              color: 'var(--foreground)',
                              fontSize: 12,
                            }}
                            labelStyle={{ color: 'var(--muted-foreground)' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="billed"
                            name={t('billed')}
                            stroke="var(--muted-foreground)"
                            strokeWidth={1.5}
                            strokeDasharray="5 5"
                            fill="transparent"
                          />
                          <Area
                            type="monotone"
                            dataKey="paid"
                            name={t('collected')}
                            stroke="var(--primary)"
                            strokeWidth={2.5}
                            fill="url(#homeCollectedRevenue)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState
                        icon={WalletCards}
                        title={t('noRevenue')}
                        description={t('noRevenueDescription')}
                      />
                    )}
                  </div>
                </section>
                <section className={styles.safePanel} aria-labelledby="clinic-safe-title">
                  <div className={styles.safeHeading}>
                    <span>
                      <WalletCards size={18} aria-hidden="true" />
                      {t('safe')}
                    </span>
                    <span className={styles.safeCurrency}>AFN</span>
                  </div>
                  <p id="clinic-safe-title" className={styles.safeLabel}>
                    {t('availableBalance')}
                  </p>
                  <p className={styles.safeBalance}>{money(safe.balance)}</p>
                  {usd ? (
                    <p className={styles.usdBalance}>
                      USD <strong>{money(usd.balance, 'USD')}</strong>
                    </p>
                  ) : null}
                  <div className={styles.safeMovements}>
                    <div>
                      <span>
                        <ArrowDownLeft size={13} aria-hidden="true" />
                        {t('moneyIn')}
                      </span>
                      <strong>{money(safe.totalIn)}</strong>
                    </div>
                    <div>
                      <span>
                        <ArrowUpRight size={13} aria-hidden="true" />
                        {t('moneyOut')}
                      </span>
                      <strong>{money(safe.totalOut)}</strong>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

const MetricCard = ({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: typeof CalendarClock;
  label: string;
  tone: 'teal' | 'amber' | 'violet' | 'sky';
  value: string;
}): JSX.Element => (
  <div className={styles.metricCard} data-tone={tone}>
    <div className={styles.metricHeading}>
      <span>{label}</span>
      <span className={styles.metricIcon}>
        <Icon size={17} aria-hidden="true" />
      </span>
    </div>
    <strong className={styles.metricValue}>{value}</strong>
    <p className={styles.metricDetail}>{detail}</p>
  </div>
);

const EmptyState = ({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof CalendarClock;
  title: string;
}): JSX.Element => (
  <div className={styles.emptyState}>
    <span className={styles.emptyIcon}>
      <Icon size={21} aria-hidden="true" />
    </span>
    <strong>{title}</strong>
    <p>{description}</p>
  </div>
);
