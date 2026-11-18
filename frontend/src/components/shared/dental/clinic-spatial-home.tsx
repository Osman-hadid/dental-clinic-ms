'use client';

import { useRef, type JSX, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { ThemeToggle } from '@/components/theme-toggle';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Link } from '@/i18n/navigation';
import { getIntlLocale } from '@/modules/common/utils/locale';
import {
  ArrowUpRight,
  CalendarClock,
  ChartNoAxesCombined,
  Compass,
  Fingerprint,
  Layers3,
  MoveUpRight,
  RefreshCw,
  ScanLine,
  Stethoscope,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import styles from './clinic-spatial-home.module.css';
import type { DashboardOverview } from './dental-chart-dashboard';

const ClinicModelViewer = dynamic(() => import('./clinic-model-viewer'), {
  loading: () => (
    <div className={styles.sceneLoading} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  ),
  ssr: false,
});

export type SpatialPanel = 'today' | 'finances';

type ClinicSpatialHomeProps = {
  firstName?: string;
  hasError?: boolean;
  isLoading?: boolean;
  locale: string;
  onNavigate: (destination: string) => void;
  onOpenPanel: (panel: SpatialPanel) => void;
  onRetry?: () => void;
  overview: DashboardOverview | null;
};

export const ClinicSpatialHome = ({
  firstName,
  hasError = false,
  isLoading = false,
  locale,
  onNavigate,
  onOpenPanel,
  onRetry,
  overview,
}: ClinicSpatialHomeProps): JSX.Element => {
  const t = useTranslations('dashboard');
  const s = useTranslations('dashboard.spatial');
  const shellRef = useRef<HTMLElement>(null);
  const number = new Intl.NumberFormat(getIntlLocale(locale));
  const count = (value: number | undefined): string =>
    value === undefined ? '—' : number.format(value);
  const today = overview?.schedule.todayKey;
  const todayDate = today ? new Date(today + 'T12:00:00') : null;
  const dateLabel =
    todayDate && !Number.isNaN(todayDate.getTime())
      ? new Intl.DateTimeFormat(getIntlLocale(locale), {
          day: 'numeric',
          month: 'short',
          weekday: 'short',
        }).format(todayDate)
      : 'SOURIRE';
  const openItems = overview
    ? (overview.schedule.eventsByDate[overview.schedule.todayKey] ?? []).filter(
        (event) =>
          !['completed', 'done', 'cancelled', 'canceled', 'rejected'].includes(
            event.status.trim().toLowerCase().replace(/\s+/g, '_')
          )
      ).length
    : undefined;
  const movePointer = (event: PointerEvent<HTMLElement>): void => {
    if (
      event.pointerType !== 'mouse' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const bounds = event.currentTarget.getBoundingClientRect();
    shellRef.current?.style.setProperty(
      '--pointer-x',
      String((event.clientX - bounds.left) / bounds.width - 0.5)
    );
    shellRef.current?.style.setProperty(
      '--pointer-y',
      String((event.clientY - bounds.top) / bounds.height - 0.5)
    );
  };
  const resetPointer = (): void => {
    shellRef.current?.style.setProperty('--pointer-x', '0');
    shellRef.current?.style.setProperty('--pointer-y', '0');
  };
  const pods = [
    {
      action: () => onNavigate('appointments'),
      description: s('receptionHint'),
      icon: CalendarClock,
      key: 'reception',
      title: s('reception'),
      value: count(overview?.schedule.todayAppointments),
    },
    {
      action: () => onNavigate('patients'),
      description: s('recordsHint'),
      icon: UsersRound,
      key: 'records',
      title: s('records'),
      value: count(overview?.patients.total),
    },
    {
      action: () => onNavigate('visits'),
      description: s('treatmentHint'),
      icon: Stethoscope,
      key: 'treatment',
      title: s('treatment'),
      value: count(overview?.schedule.todayVisits),
    },
    {
      action: () => onOpenPanel('finances'),
      description: s('financeHint'),
      icon: WalletCards,
      key: 'finance',
      title: s('finance'),
      value: 'AFN',
    },
  ];

  return (
    <main
      ref={shellRef}
      className={styles.world}
      onPointerMove={movePointer}
      onPointerLeave={resetPointer}
      aria-label={s('worldLabel')}
    >
      <div className={styles.atmosphere} aria-hidden="true">
        <div className={styles.sunlight} />
        <div className={styles.floorGrid} />
        <span className={styles.orbitOne} />
        <span className={styles.orbitTwo} />
        <span className={styles.worldLettering}>sourire.</span>
      </div>

      <header className={styles.topbar}>
        <div className={styles.brandGroup}>
          <SidebarTrigger className={styles.menuButton} />
          <span className={styles.brandSymbol} aria-hidden="true">
            <Fingerprint size={25} strokeWidth={1.5} />
          </span>
          <div className={styles.brand}>
            <strong>
              Sourire<span>®</span>
            </strong>
            <small>{s('atlas')}</small>
          </div>
        </div>
        <div className={styles.topbarActions}>
          <span className={styles.date}>{dateLabel}</span>
          {onRetry ? (
            <button
              type="button"
              className={styles.refreshButton}
              onClick={onRetry}
              disabled={isLoading}
              aria-label={s('refresh')}
              title={s('refresh')}
            >
              <RefreshCw
                size={15}
                className={isLoading ? styles.spinning : undefined}
                aria-hidden="true"
              />
            </button>
          ) : null}
          <div className={styles.theme}>
            <ThemeToggle />
          </div>
          <Link
            href="/account"
            className={styles.account}
            aria-label={s('account')}
            title={s('account')}
          >
            {firstName?.trim().charAt(0).toUpperCase() || (
              <UserRound size={16} aria-hidden="true" />
            )}
          </Link>
        </div>
      </header>

      <div className={styles.scene} aria-label={s('worldLabel')}>
        <ClinicModelViewer immersive onNavigate={onNavigate} />
      </div>

      <div className={styles.introduction}>
        <p className={styles.greeting}>
          <span />
          {firstName ? t('greeting', { name: firstName }) : t('greetingFallback')}
        </p>
        <h1>
          {s('title')}
          <br />
          <em>{s('titleAccent')}</em>
        </h1>
        <p className={styles.description}>{s('description')}</p>
        <span className={styles.titleLine} aria-hidden="true" />
      </div>

      <div className={styles.sceneIndex} aria-hidden="true">
        <span>01</span>
        <small>{s('modelLabel')}</small>
      </div>
      <div className={styles.locationMark} aria-hidden="true">
        <ScanLine size={15} />
        <span>{s('moduleHint')}</span>
      </div>

      <nav className={styles.portals} aria-label={s('navigation')}>
        {pods.map(({ action, description, icon: Icon, key, title, value }, index) => (
          <div key={key} className={styles.portalPosition} data-room={key}>
            <button
              type="button"
              className={styles.portal}
              onClick={action}
              disabled={key === 'finance' && !overview}
              aria-label={title}
            >
              <span className={styles.portalIcon}>
                <Icon size={23} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span className={styles.portalCopy}>
                <small>
                  {'0' + (index + 1)} / {value}
                </small>
                <strong>{title}</strong>
                <span>{description}</span>
              </span>
              <ArrowUpRight className={styles.portalArrow} size={15} aria-hidden="true" />
            </button>
            <span className={styles.portalAnchor} aria-hidden="true">
              <i />
              <i />
            </span>
          </div>
        ))}
      </nav>

      <aside className={styles.dayBrief} aria-label={s('dailyBrief')}>
        <div className={styles.briefHeader}>
          <span>{s('dayLabel')}</span>
          <span className={styles.briefDot} />
        </div>
        <div className={styles.briefValues}>
          <div>
            <strong>{count(overview?.schedule.todayAppointments)}</strong>
            <span>{t('appointments')}</span>
          </div>
          <div>
            <strong>{count(openItems)}</strong>
            <span>{t('openItems')}</span>
          </div>
        </div>
        <button type="button" onClick={() => onOpenPanel('today')} disabled={!overview}>
          {s('dailyBrief')}
          <MoveUpRight size={14} aria-hidden="true" />
        </button>
      </aside>

      <div
        className={styles.connection}
        data-state={hasError ? 'error' : isLoading ? 'loading' : 'ready'}
        role="status"
      >
        <span />
        <p>{hasError ? s('unavailable') : isLoading ? s('loading') : s('live')}</p>
        {hasError && onRetry ? (
          <button type="button" onClick={onRetry}>
            {s('retry')}
          </button>
        ) : null}
      </div>

      <div className={styles.dockWrap}>
        <nav className={styles.dock} aria-label={s('navigation')}>
          <span className={styles.dockItem + ' ' + styles.dockActive} aria-current="page">
            <span className={styles.dockIcon}>
              <Compass size={22} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <span>{s('explore')}</span>
          </span>
          <button
            type="button"
            className={styles.dockItem}
            onClick={() => onOpenPanel('today')}
            disabled={!overview}
          >
            <span className={styles.dockIcon}>
              <Layers3 size={22} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <span>{s('dailyBrief')}</span>
          </button>
          <button
            type="button"
            className={styles.dockItem}
            onClick={() => onOpenPanel('finances')}
            disabled={!overview}
          >
            <span className={styles.dockIcon}>
              <ChartNoAxesCombined size={22} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <span>{s('finances')}</span>
          </button>
          <span className={styles.dockDivider} aria-hidden="true" />
          <button type="button" className={styles.dockItem} onClick={() => onNavigate('patients')}>
            <span className={styles.dockIcon}>
              <UsersRound size={22} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <span>{s('patients')}</span>
          </button>
          <Link href="/account" className={styles.dockItem}>
            <span className={styles.dockIcon}>
              <UserRound size={22} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <span>{s('account')}</span>
          </Link>
        </nav>
      </div>
    </main>
  );
};
