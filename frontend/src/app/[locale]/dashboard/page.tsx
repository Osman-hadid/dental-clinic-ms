'use client';

import { JSX, useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import {
  type DashboardImplantSupplierSummary,
  type DashboardSafeSummary,
  type DashboardSafeTransaction,
  DentalChartDashboard,
} from '@/components/shared/dental/dental-chart-dashboard';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { DEFAULT_AFN_PER_USD } from '@/lib/currency-utils';
import { aggregateImplantSupplierBalances } from '@/modules/dental-management/presentation/utils/implant-supplier-analytics';
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

type SessionTaskRow = {
  createdAt?: string;
  id: number | string;
  notes?: string;
  patientId: string;
  status?: string;
  title?: string;
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

const fetchAllPatientIds = async (): Promise<string[]> => {
  const patientIds: string[] = [];
  let page = 1;

  while (true) {
    const response = await apiClient.get<PaginatedRowsResponse>('/api/v1/dental-management/patients', {
      params: {
        page,
        perPage: TABLE_PER_PAGE,
      },
    });
    const payload = response.data;
    const pageRows = Array.isArray(payload?.data) ? payload.data : [];
    patientIds.push(...pageRows
      .map((row) => asText(row.id))
      .filter(Boolean));

    const currentPage = Number(payload?.meta?.currentPage ?? page);
    const lastPage = Number(payload?.meta?.lastPage ?? currentPage);
    if (pageRows.length === 0 || currentPage >= lastPage) break;
    page += 1;
  }

  return [...new Set(patientIds)];
};

const fetchImplantSessionTasks = async (): Promise<SessionTaskRow[]> => {
  const patientIds = await fetchAllPatientIds();
  if (patientIds.length === 0) return [];

  const rows: SessionTaskRow[] = [];
  const batchSize = 15;

  for (let index = 0; index < patientIds.length; index += batchSize) {
    const batch = patientIds.slice(index, index + batchSize);
    const batchResponses = await Promise.all(
      batch.map(async (patientId) => {
        const response = await apiClient.get<Array<Record<string, unknown>>>(
          `/api/v1/dental-management/patients/${patientId}/session-tasks`
        );
        if (!response.success || !Array.isArray(response.data)) {
          return [] as SessionTaskRow[];
        }

        return response.data.map((task) => ({
          createdAt: asText(task.createdAt ?? task.created_at),
          id: asText(task.id),
          notes: asText(task.notes),
          patientId,
          status: asText(task.status),
          title: asText(task.title),
        }));
      })
    );

    batchResponses.forEach((batchRows) => {
      rows.push(...batchRows);
    });
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
  const [implantSupplierSummary, setImplantSupplierSummary] = useState<DashboardImplantSupplierSummary>({
    byAvailability: [],
    implantCount: 0,
    paidRatio: 0,
    totalPaid: 0,
    totalSupplierCost: 0,
    totalUnpaid: 0,
    unpaidCount: 0,
  });

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
  const isPrimaryDashboardLoading =
    isLoadingAppointments
    || isLoadingVisits
    || isLoadingPatients
    || isLoadingInvoices
    || isLoadingPayments;

  const fetchSafeSummary = useCallback(async (): Promise<void> => {
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
    }
  }, []);

  useEffect(() => {
    void fetchSafeSummary();
  }, [fetchSafeSummary]);

  const fetchImplantSupplierSummary = useCallback(async (): Promise<void> => {
    try {
      const allTasks = await fetchImplantSessionTasks();
      const summary = aggregateImplantSupplierBalances(allTasks);
      const byAvailability = (['not_available', 'in_purchase', 'available', 'done'] as const).map((status) => ({
        count: summary.byAvailability[status].count,
        paid: summary.byAvailability[status].paid,
        status,
        total: summary.byAvailability[status].total,
        unpaid: summary.byAvailability[status].unpaid,
      }));

      setImplantSupplierSummary({
        byAvailability,
        implantCount: summary.implantCount,
        paidRatio: summary.paidRatio,
        totalPaid: summary.totalPaid,
        totalSupplierCost: summary.totalSupplierCost,
        totalUnpaid: summary.totalUnpaid,
        unpaidCount: summary.unpaidCount,
      });
    } catch {
      setImplantSupplierSummary({
        byAvailability: [],
        implantCount: 0,
        paidRatio: 0,
        totalPaid: 0,
        totalSupplierCost: 0,
        totalUnpaid: 0,
        unpaidCount: 0,
      });
    }
  }, []);

  useEffect(() => {
    void fetchImplantSupplierSummary();
  }, [fetchImplantSupplierSummary]);

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
              implantSupplierSummary={implantSupplierSummary}
              invoices={invoices}
              locale={locale}
              payments={payments}
              visits={visits}
              patients={patients}
              safeSummary={safeSummary}
              isLoading={isPrimaryDashboardLoading}
            />
          </div>
        </div>
      </div>
    </>
  );
}

