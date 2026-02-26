'use client';

import { JSX, useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import {
  type DashboardSafeSummary,
  type DashboardSafeTransaction,
  DentalChartDashboard,
} from '@/components/shared/dental/dental-chart-dashboard';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { DEFAULT_AFN_PER_USD } from '@/lib/currency-utils';
import {
  useAppointmentList,
  useInvoiceList,
  usePatientList,
  usePaymentList,
  useVisitList,
} from '@/modules/dental-management/presentation/hooks';

const APPOINTMENT_RELATIONS = ['patient', 'dentist'];
const APPOINTMENT_SEARCH_FIELDS = ['tag', 'notes'];
const PATIENT_SEARCH_FIELDS = ['patientCode', 'firstName', 'lastName'];
const TABLE_PER_PAGE = 100;
const VISIT_RELATIONS = ['appointment', 'patient', 'dentist'];
const VISIT_SEARCH_FIELDS = ['tag', 'diagnosisNotes'];
const apiClient = new AxiosClient();

type PaginatedRowsResponse = {
  data?: Array<Record<string, unknown>>;
  meta?: {
    currentPage?: number;
    lastPage?: number;
  };
};

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim();
  return '';
};

const parseAmount = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(asText(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const fetchAllSafeRows = async (): Promise<DashboardSafeTransaction[]> => {
  const rows: DashboardSafeTransaction[] = [];
  let page = 1;

  while (true) {
    const response = await apiClient.get<PaginatedRowsResponse>('/api/v1/dental-management/safe-transactions', {
      params: {
        include: ['pickedByStaff'],
        page,
        perPage: TABLE_PER_PAGE,
        sortBy: 'transactionDate',
        sortDirection: 'desc',
      },
    });
    const payload = response.data;
    const pageRows = Array.isArray(payload?.data) ? payload.data : [];
    rows.push(...pageRows.map((row) => {
      const pickedBy = row.pickedByStaff as Record<string, unknown> | undefined;
      const pickedByName = pickedBy
        ? [asText(pickedBy.firstName ?? pickedBy.first_name), asText(pickedBy.lastName ?? pickedBy.last_name)]
          .filter(Boolean)
          .join(' ')
        : '';
      return {
        amount: parseAmount(row.amount),
        direction: asText(row.direction),
        entryType: asText(row.entryType ?? row.entry_type),
        id: asText(row.id),
        notes: asText(row.notes),
        pickedByStaffId: asText(row.pickedByStaffId ?? row.picked_by_staff_id),
        pickedByStaffName: pickedByName || asText(pickedBy?.fullName ?? pickedBy?.name),
        transactionDate: asText(row.transactionDate ?? row.transaction_date),
      };
    }));

    const currentPage = Number(payload?.meta?.currentPage ?? page);
    const lastPage = Number(payload?.meta?.lastPage ?? currentPage);
    if (pageRows.length === 0 || currentPage >= lastPage) break;
    page += 1;
  }

  return rows;
};

// eslint-disable-next-line react/function-component-definition
export default function Page(): JSX.Element {
  const locale = useLocale();
  const t = useTranslations('global');
  const [safeSummary, setSafeSummary] = useState<DashboardSafeSummary>({
    afnPerUsd: DEFAULT_AFN_PER_USD,
    balance: 0,
    totalIn: 0,
    totalOut: 0,
    transactions: [],
  });
  const [isSafeLoading, setIsSafeLoading] = useState(false);

  const { entities: appointments, isFetching: isLoadingAppointments } = useAppointmentList(
    1,
    TABLE_PER_PAGE,
    '',
    APPOINTMENT_SEARCH_FIELDS,
    APPOINTMENT_RELATIONS,
    {}
  );

  const { entities: visits, isFetching: isLoadingVisits } = useVisitList(
    1,
    TABLE_PER_PAGE,
    '',
    VISIT_SEARCH_FIELDS,
    VISIT_RELATIONS,
    {}
  );

  const { entities: patients, isFetching: isLoadingPatients } = usePatientList(
    1,
    TABLE_PER_PAGE,
    '',
    PATIENT_SEARCH_FIELDS,
    [],
    {}
  );
  const { entities: invoices, isFetching: isLoadingInvoices } = useInvoiceList(
    1,
    TABLE_PER_PAGE,
    '',
    [],
    [],
    {}
  );
  const { entities: payments, isFetching: isLoadingPayments } = usePaymentList(
    1,
    TABLE_PER_PAGE,
    '',
    [],
    [],
    {}
  );

  const fetchSafeSummary = useCallback(async (): Promise<void> => {
    setIsSafeLoading(true);
    try {
      const [balanceResponse, transactions] = await Promise.all([
        apiClient.get<{ afnPerUsd?: number; balance?: number; totalIn?: number; totalOut?: number }>(
          '/api/v1/dental-management/safe-transactions/balance'
        ),
        fetchAllSafeRows(),
      ]);

      setSafeSummary({
        afnPerUsd: parseAmount(balanceResponse.data?.afnPerUsd) || DEFAULT_AFN_PER_USD,
        balance: parseAmount(balanceResponse.data?.balance),
        totalIn: parseAmount(balanceResponse.data?.totalIn),
        totalOut: parseAmount(balanceResponse.data?.totalOut),
        transactions,
      });
    } catch {
      setSafeSummary({
        afnPerUsd: DEFAULT_AFN_PER_USD,
        balance: 0,
        totalIn: 0,
        totalOut: 0,
        transactions: [],
      });
    } finally {
      setIsSafeLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSafeSummary();
  }, [fetchSafeSummary]);

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
            <DentalChartDashboard
              appointments={appointments}
              invoices={invoices}
              locale={locale}
              payments={payments}
              visits={visits}
              patients={patients}
              safeSummary={safeSummary}
              isLoading={
                isLoadingAppointments
                || isLoadingVisits
                || isLoadingPatients
                || isLoadingInvoices
                || isLoadingPayments
                || isSafeLoading
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}

