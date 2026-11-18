'use client';

import type { JSX } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { ArrowUpRight, CalendarClock, Stethoscope, UsersRound } from 'lucide-react';
import type { ClinicDestination } from './clinic-model';
import styles from './clinic-model.module.css';

const ClinicViewerPlaceholder = (): JSX.Element => {
  const t = useTranslations('dashboard');
  return (
    <div className={styles.viewerPlaceholder} role="status">
      {t('openingClinic')}
    </div>
  );
};

const ClinicModelViewer = dynamic(() => import('./clinic-model-viewer'), {
  loading: () => <ClinicViewerPlaceholder />,
  ssr: false,
});

type ClinicWorkspaceSceneProps = {
  appointments: number;
  compact?: boolean;
  onNavigate: (destination: ClinicDestination) => void;
};

export const ClinicWorkspaceScene = ({
  appointments,
  compact = false,
  onNavigate,
}: ClinicWorkspaceSceneProps): JSX.Element => {
  const t = useTranslations('dashboard');
  const format = useFormatter();
  return (
    <div className={styles.scene + (compact ? ' ' + styles.compactScene : '')}>
      <ClinicModelViewer onNavigate={onNavigate} />
      <div className={styles.stations} aria-label={t('clinicWorkspaces')}>
        <button type="button" className={styles.station} onClick={() => onNavigate('appointments')}>
          <span className={styles.stationIcon}>
            <CalendarClock size={17} aria-hidden="true" />
          </span>
          <span>
            <strong>{t('reception')}</strong>
            <small>{t('appointmentsToday', { count: format.number(appointments) })}</small>
          </span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </button>
        <button type="button" className={styles.station} onClick={() => onNavigate('patients')}>
          <span className={styles.stationIcon}>
            <UsersRound size={17} aria-hidden="true" />
          </span>
          <span>
            <strong>{t('patientLounge')}</strong>
            <small>{t('patients')}</small>
          </span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </button>
        <button type="button" className={styles.station} onClick={() => onNavigate('visits')}>
          <span className={styles.stationIcon}>
            <Stethoscope size={17} aria-hidden="true" />
          </span>
          <span>
            <strong>{t('treatmentRoom')}</strong>
            <small>{t('openVisits')}</small>
          </span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
