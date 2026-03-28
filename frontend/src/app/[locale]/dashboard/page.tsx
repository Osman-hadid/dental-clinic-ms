'use client';

import { JSX, useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { DentalChartDashboard } from '@/components/shared/dental/dental-chart-dashboard';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
const apiClient = new AxiosClient();

type DashboardOverviewResponse = {
  schedule: {
    start: string;
    end: string;
    todayKey: string;
    todayVisits: number;
    todayAppointments: number;
    eventsByDate: Record<
      string,
      Array<{
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
      }>
    >;
    upcomingEvents: Array<{
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
    }>;
  };
  patients: { total: number; new30d: number; returning: number };
  performance: { completionRate: number; calendarCoverageDays: number };
  operations: {
    criticalDiskWarning: boolean;
    diskFreePercent: number;
    failedBackupCount: number;
    healthWarningCount: number;
    lastSuccessfulBackupAt: string | null;
    latestBackupStatus: string;
    lowDiskWarning: boolean;
    nextScheduledRunAt: string | null;
    status: string;
  };
  charts: {
    revenueRange: '7d' | '30d' | '90d';
    revenueSeries: Array<{ date: string; billed: number; paid: number }>;
    appointmentMix: { scheduled: number; completed: number; cancelled: number };
  };
  safe: {
    balance: number;
    totalIn: number;
    totalOut: number;
    afnPerUsd: number;
    topPickups: Array<{ name: string; amount: number }>;
    recentTransactions: Array<{
      id: string;
      entryType: string;
      direction: string;
      amount: number;
      transactionDate: string;
      pickedByStaffId: string;
      pickedByStaffName: string;
      notes: string;
    }>;
  };
  implantSupplier: {
    implantCount: number;
    paidRatio: number;
    totalPaid: number;
    totalSupplierCost: number;
    totalUnpaid: number;
    unpaidCount: number;
    byAvailability: Array<{
      status: 'not_available' | 'in_purchase' | 'available' | 'done';
      count: number;
      paid: number;
      total: number;
      unpaid: number;
    }>;
  };
  radialSafeSummary: {
    safeBalance: number;
    debtOutstanding: number;
    supplierUnpaids: number;
    ring: { safePercent: number; debtPercent: number; unpaidPercent: number };
    chartData: Array<{ category: 'inSafe' | 'debts' | 'unpaids'; value: number }>;
  } | null;
};

// eslint-disable-next-line react/function-component-definition
export default function Page(): JSX.Element {
  const locale = useLocale();
  const t = useTranslations('global');
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [revenueRange, setRevenueRange] = useState<'7d' | '30d' | '90d'>('90d');

  const fetchOverview = useCallback(async (range: '7d' | '30d' | '90d'): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<DashboardOverviewResponse>(
        '/api/v1/dental-management/dashboard/overview',
        {
          params: { revenueRange: range },
        }
      );
      setOverview(response.data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview(revenueRange);
  }, [fetchOverview, revenueRange]);

  return (
    <>
      <Header
        breadcrumbs={[
          { href: '#', id: 'dashboard', label: t('dashboard') },
          { id: 'data', isCurrent: true, label: t('data') },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            {overview ? (
              <DentalChartDashboard
                locale={locale}
                overview={overview}
                isLoading={isLoading}
                onRevenueRangeChange={setRevenueRange}
              />
            ) : (
              <DentalChartDashboard
                locale={locale}
                overview={null}
                isLoading={isLoading}
                onRevenueRangeChange={setRevenueRange}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

