'use client';

import { JSX, useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import {
  DentalChartDashboard,
  type DashboardOverview,
  type RevenueRange,
} from '@/components/shared/dental/dental-chart-dashboard';
import { useAuthStore } from '@/modules/auth/application/stores/auth-store';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';

const apiClient = new AxiosClient();

// eslint-disable-next-line react/function-component-definition
export default function Page(): JSX.Element {
  const locale = useLocale();
  const firstName = useAuthStore((state) => state.user?.firstName);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [revenueRange, setRevenueRange] = useState<RevenueRange>('90d');
  const requestSequence = useRef(0);

  const fetchOverview = useCallback(async (range: RevenueRange, fresh = false): Promise<void> => {
    const requestId = ++requestSequence.current;
    setIsLoading(true);
    setHasError(false);
    try {
      const response = await apiClient.get<DashboardOverview>(
        '/api/v1/dental-management/dashboard/overview',
        {
          params: { revenueRange: range, ...(fresh ? { _refresh: Date.now() } : {}) },
        }
      );
      if (!response.success || !response.data) throw new Error('Overview unavailable');
      if (requestId === requestSequence.current) setOverview(response.data);
    } catch {
      if (requestId === requestSequence.current) setHasError(true);
    } finally {
      if (requestId === requestSequence.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview(revenueRange);
  }, [fetchOverview, revenueRange]);

  return (
    <DentalChartDashboard
      firstName={firstName}
      locale={locale}
      overview={overview}
      hasError={hasError}
      isLoading={isLoading}
      revenueRange={revenueRange}
      onRevenueRangeChange={setRevenueRange}
      onRetry={() => {
        void fetchOverview(revenueRange, true);
      }}
    />
  );
}
