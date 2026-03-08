'use client';

import { JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { fetchAllRows } from '@/modules/common/infrastructure/api/fetch-all-rows';
import { useGetStaff } from '@/modules/dental-management/presentation/hooks';
import { ArrowLeft, Coins, HandCoins, ReceiptText, Users } from 'lucide-react';

type SalaryRow = {
  netAmount: number;
  id: string;
  paymentDate: string;
  salaryMonth: string;
  staffId: string;
  status: string;
};

type SafeRow = {
  amount: number;
  direction: string;
  entryType: string;
  id: string;
  notes: string;
  pickedByStaffId: string;
  transactionDate: string;
};

type VisitRow = {
  dentistId: string;
  id: string;
  patientId: string;
};

type InvoiceRow = {
  id: string;
  invoiceDate: string;
  netAmount: number;
  paidAmount: number;
  visitId: string;
};

type StaffFinancialProfile = {
  collectionsAmount: number;
  debtAmount: number;
  invoiceRows: InvoiceRow[];
  patientCount: number;
  safeOutAmount: number;
  safeRows: SafeRow[];
  salaryPaidAmount: number;
  salaryPendingAmount: number;
  salaryRows: SalaryRow[];
  visitCount: number;
};

const apiClient = new AxiosClient();

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

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    currency: 'AFN',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(value);

const formatDate = (value: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(parsed);
};

const formatSalaryMonth = (value: string): string => {
  if (!value) return '-';
  const [yearRaw, monthRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1)
  );
};

const createEmptyProfile = (): StaffFinancialProfile => ({
  collectionsAmount: 0,
  debtAmount: 0,
  invoiceRows: [],
  patientCount: 0,
  safeOutAmount: 0,
  safeRows: [],
  salaryPaidAmount: 0,
  salaryPendingAmount: 0,
  salaryRows: [],
  visitCount: 0,
});

// eslint-disable-next-line react/function-component-definition
export default function StaffDashboardPage(): JSX.Element {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tSidebar = useTranslations('sidebar.dentalManagement');

  const staffId = searchParams.get('staffId')?.trim() ?? '';

  const { data: staffResponse, isFetching: isLoadingStaff } = useGetStaff(staffId, {
    enabled: !!staffId,
  });
  const staff = staffResponse?.data ?? null;

  const [salaryRows, setSalaryRows] = useState<SalaryRow[]>([]);
  const [safeRows, setSafeRows] = useState<SafeRow[]>([]);
  const [visitRows, setVisitRows] = useState<VisitRow[]>([]);
  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([]);
  const [isLoadingFinance, setIsLoadingFinance] = useState(false);

  const fetchFinanceData = useCallback(async (): Promise<void> => {
    if (!staffId) return;

    setIsLoadingFinance(true);
    try {
      const [salaryItems, safeItems, visitItems] = await Promise.all([
        fetchAllRows(apiClient, '/api/v1/dental-management/salary-payments', {
          sortBy: 'paymentDate',
          sortDirection: 'desc',
          'filter[staffId]': staffId,
        }),
        fetchAllRows(apiClient, '/api/v1/dental-management/safe-transactions', {
          sortBy: 'transactionDate',
          sortDirection: 'desc',
          'filter[pickedByStaffId]': staffId,
        }),
        fetchAllRows(apiClient, '/api/v1/dental-management/visits', {
          sortBy: 'visitDate',
          sortDirection: 'desc',
          'filter[dentistId]': staffId,
        }),
      ]);

      const visitIds = Array.from(
        new Set(
          visitItems
            .map((row) => asText(row.id))
            .filter(Boolean)
        )
      );
      const invoiceBatches = Array.from(
        { length: Math.ceil(visitIds.length / 50) },
        (_, index) => visitIds.slice(index * 50, index * 50 + 50)
      );
      const invoiceItems = invoiceBatches.length === 0
        ? []
        : (await Promise.all(
          invoiceBatches.map((visitIdBatch) => fetchAllRows(apiClient, '/api/v1/dental-management/invoices', {
            include: ['payments'],
            sortBy: 'invoiceDate',
            sortDirection: 'desc',
            'filter[visitId]': visitIdBatch,
          }))
        )).flat();

      setSalaryRows(
        salaryItems.map((row) => ({
          id: asText(row.id),
          netAmount: parseAmount(row.netAmount ?? row.net_amount),
          paymentDate: asText(row.paymentDate ?? row.payment_date),
          salaryMonth: asText(row.salaryMonth ?? row.salary_month),
          staffId: asText(row.staffId ?? row.staff_id),
          status: asText(row.status).toLowerCase(),
        }))
      );

      setSafeRows(
        safeItems.map((row) => ({
          amount: parseAmount(row.amount),
          direction: asText(row.direction).toLowerCase(),
          entryType: asText(row.entryType ?? row.entry_type),
          id: asText(row.id),
          notes: asText(row.notes),
          pickedByStaffId: asText(row.pickedByStaffId ?? row.picked_by_staff_id),
          transactionDate: asText(row.transactionDate ?? row.transaction_date),
        }))
      );

      setVisitRows(
        visitItems.map((row) => ({
          dentistId: asText(row.dentistId ?? row.dentist_id),
          id: asText(row.id),
          patientId: asText(row.patientId ?? row.patient_id),
        }))
      );

      setInvoiceRows(
        invoiceItems.map((row) => {
          const netAmount = parseAmount(row.netAmount ?? row.net_amount);
          const payments = Array.isArray(row.payments) ? row.payments : [];
          const paidFromPayments = payments.reduce((sum, payment) => {
            if (!payment || typeof payment !== 'object') return sum;
            return sum + parseAmount((payment as Record<string, unknown>).amount);
          }, 0);
          const status = asText(row.status).toLowerCase();
          const paidAmount =
            status === 'paid' && paidFromPayments <= 0 && netAmount > 0
              ? netAmount
              : paidFromPayments;

          return {
            id: asText(row.id),
            invoiceDate: asText(row.invoiceDate ?? row.invoice_date),
            netAmount,
            paidAmount,
            visitId: asText(row.visitId ?? row.visit_id),
          };
        })
      );
    } finally {
      setIsLoadingFinance(false);
    }
  }, [staffId]);

  useEffect(() => {
    void fetchFinanceData();
  }, [fetchFinanceData]);

  const profile = useMemo(() => {
    if (!staffId) return null;

    const selectedProfile = createEmptyProfile();
    const uniquePatients = new Set<string>();
    const visitDentistByVisitId = new Map<string, string>();

    visitRows.forEach((visit) => {
      visitDentistByVisitId.set(visit.id, visit.dentistId);
      if (visit.dentistId !== staffId) return;

      selectedProfile.visitCount += 1;
      if (visit.patientId) {
        uniquePatients.add(visit.patientId);
      }
    });

    selectedProfile.patientCount = uniquePatients.size;

    salaryRows.forEach((salary) => {
      if (salary.staffId !== staffId) return;
      selectedProfile.salaryRows.push(salary);
      if (salary.status === 'paid' || salary.status === 'partial') {
        selectedProfile.salaryPaidAmount += salary.netAmount;
      } else {
        selectedProfile.salaryPendingAmount += salary.netAmount;
      }
    });

    safeRows.forEach((row) => {
      if (row.pickedByStaffId !== staffId || row.direction !== 'out') return;
      selectedProfile.safeRows.push(row);
      selectedProfile.safeOutAmount += row.amount;
    });

    invoiceRows.forEach((invoice) => {
      const dentistId = visitDentistByVisitId.get(invoice.visitId);
      if (dentistId !== staffId) return;

      selectedProfile.invoiceRows.push(invoice);
      selectedProfile.collectionsAmount += invoice.paidAmount;
      selectedProfile.debtAmount += Math.max(0, invoice.netAmount - invoice.paidAmount);
    });

    return selectedProfile;
  }, [invoiceRows, safeRows, salaryRows, staffId, visitRows]);

  const dashboardTitle = staff?.fullName || 'Staff Dashboard';
  const isLoading = isLoadingStaff || isLoadingFinance;

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'staff', href: `/${locale}/dental-management/staff`, label: tSidebar('staff') },
          { id: 'staffDashboard', isCurrent: true, label: dashboardTitle },
        ]}
      />

      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <div className="flex justify-start">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  router.push(`/${locale}/dental-management/staff`);
                }}
              >
                <ArrowLeft className="me-2 size-4" />
                Back To Staff
              </Button>
            </div>

            {!staffId ? (
              <section className="rounded-2xl border bg-background p-4">
                <p className="text-sm text-muted-foreground">Invalid staff id.</p>
              </section>
            ) : !isLoadingStaff && !staff ? (
              <section className="rounded-2xl border bg-background p-4">
                <p className="text-sm text-muted-foreground">Staff record not found.</p>
              </section>
            ) : staff && profile ? (
              <section className="rounded-2xl border bg-background p-3 md:p-4">
                <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  <span>Staff dashboard</span>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                  <section className="rounded-2xl border p-4">
                    <h3 className="text-lg font-semibold">
                      {staff.fullName || `Staff #${staff.id}`}
                    </h3>
                    <p className="text-sm text-muted-foreground">Profile and financial snapshot</p>

                    <div className="mt-4 space-y-2 text-sm">
                      <p>
                        <strong>Role:</strong> {staff.role || '-'}
                      </p>
                      <p>
                        <strong>Specialization:</strong> {staff.specialization || '-'}
                      </p>
                      <p>
                        <strong>Contact:</strong> {staff.contactNumber || '-'}
                      </p>
                      <p>
                        <strong>Email:</strong> {staff.email || '-'}
                      </p>
                      <p>
                        <strong>Hire Date:</strong> {formatDate(staff.hireDate)}
                      </p>
                      <p>
                        <strong>Remarks:</strong> {staff.remarks || '-'}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">Patients Served</p>
                        <p className="font-semibold">{profile.patientCount}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">Total Visits</p>
                        <p className="font-semibold">{profile.visitCount}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">Collected</p>
                        <p className="font-semibold">{formatCurrency(profile.collectionsAmount)}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">Outstanding</p>
                        <p className="font-semibold">{formatCurrency(profile.debtAmount)}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">Salary Paid</p>
                        <p className="font-semibold">{formatCurrency(profile.salaryPaidAmount)}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">Safe Picked</p>
                        <p className="font-semibold">{formatCurrency(profile.safeOutAmount)}</p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <section className="rounded-2xl border p-4">
                      <h4 className="inline-flex items-center gap-2 text-sm font-semibold">
                        <Coins className="size-4 text-emerald-600" />
                        Salary History
                      </h4>
                      {profile.salaryRows.length === 0 ? (
                        <p className="mt-2 text-sm text-muted-foreground">No salary records yet.</p>
                      ) : (
                        <div className="mt-3 max-h-56 overflow-y-auto rounded-md border">
                          <table className="min-w-full text-xs">
                            <thead className="bg-muted/30">
                              <tr>
                                <th className="px-2 py-2 text-left">Month</th>
                                <th className="px-2 py-2 text-left">Date</th>
                                <th className="px-2 py-2 text-left">Status</th>
                                <th className="px-2 py-2 text-right">Net</th>
                              </tr>
                            </thead>
                            <tbody>
                              {profile.salaryRows.map((row) => (
                                <tr key={row.id} className="border-t">
                                  <td className="px-2 py-2">
                                    {formatSalaryMonth(row.salaryMonth)}
                                  </td>
                                  <td className="px-2 py-2">{formatDate(row.paymentDate)}</td>
                                  <td className="px-2 py-2 capitalize">{row.status || '-'}</td>
                                  <td className="px-2 py-2 text-right">
                                    {formatCurrency(row.netAmount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>

                    <section className="rounded-2xl border p-4">
                      <h4 className="inline-flex items-center gap-2 text-sm font-semibold">
                        <ReceiptText className="size-4 text-blue-600" />
                        Invoice Payments
                      </h4>
                      {profile.invoiceRows.length === 0 ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No invoice payment data for this staff yet.
                        </p>
                      ) : (
                        <div className="mt-3 max-h-56 overflow-y-auto rounded-md border">
                          <table className="min-w-full text-xs">
                            <thead className="bg-muted/30">
                              <tr>
                                <th className="px-2 py-2 text-left">Invoice</th>
                                <th className="px-2 py-2 text-left">Date</th>
                                <th className="px-2 py-2 text-right">Net</th>
                                <th className="px-2 py-2 text-right">Paid</th>
                                <th className="px-2 py-2 text-right">Debt</th>
                              </tr>
                            </thead>
                            <tbody>
                              {profile.invoiceRows.map((row) => (
                                <tr key={row.id} className="border-t">
                                  <td className="px-2 py-2">#{row.id}</td>
                                  <td className="px-2 py-2">{formatDate(row.invoiceDate)}</td>
                                  <td className="px-2 py-2 text-right">
                                    {formatCurrency(row.netAmount)}
                                  </td>
                                  <td className="px-2 py-2 text-right">
                                    {formatCurrency(row.paidAmount)}
                                  </td>
                                  <td className="px-2 py-2 text-right">
                                    {formatCurrency(Math.max(0, row.netAmount - row.paidAmount))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>

                    <section className="rounded-2xl border p-4">
                      <h4 className="inline-flex items-center gap-2 text-sm font-semibold">
                        <HandCoins className="size-4 text-orange-600" />
                        Safe Pickups
                      </h4>
                      {profile.safeRows.length === 0 ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No safe pickup entries for this staff.
                        </p>
                      ) : (
                        <div className="mt-3 max-h-56 overflow-y-auto rounded-md border">
                          <table className="min-w-full text-xs">
                            <thead className="bg-muted/30">
                              <tr>
                                <th className="px-2 py-2 text-left">Date</th>
                                <th className="px-2 py-2 text-left">Type</th>
                                <th className="px-2 py-2 text-right">Amount</th>
                                <th className="px-2 py-2 text-left">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {profile.safeRows.map((row) => (
                                <tr key={row.id} className="border-t">
                                  <td className="px-2 py-2">{formatDate(row.transactionDate)}</td>
                                  <td className="px-2 py-2 capitalize">
                                    {row.entryType.replaceAll('_', ' ') || '-'}
                                  </td>
                                  <td className="px-2 py-2 text-right">
                                    {formatCurrency(row.amount)}
                                  </td>
                                  <td className="px-2 py-2">{row.notes || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  </section>
                </div>

                {isLoading ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Loading staff financial data...
                  </p>
                ) : null}
              </section>
            ) : (
              <section className="rounded-2xl border bg-background p-4">
                <p className="text-sm text-muted-foreground">Loading staff dashboard...</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

