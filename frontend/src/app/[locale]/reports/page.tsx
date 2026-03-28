'use client';

import { JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { LoadingState } from '@/components/shared/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { createDefaultReportRange, fetchReport, triggerReportExport } from '@/modules/dental-management/presentation/reports/report-client';
import { AuditReportPanel } from '@/modules/dental-management/presentation/reports/audit-report-panel';
import { ClinicalReportPanel } from '@/modules/dental-management/presentation/reports/clinical-report-panel';
import { ExecutiveReportPanel } from '@/modules/dental-management/presentation/reports/executive-report-panel';
import { FinancialReportPanel } from '@/modules/dental-management/presentation/reports/financial-report-panel';
import { InventoryReportPanel } from '@/modules/dental-management/presentation/reports/inventory-report-panel';
import {
  AuditData,
  ClinicalData,
  CsvExportType,
  ExecutiveData,
  FilterOptionsResponse,
  FiltersState,
  FinancialData,
  InventoryData,
  ReportTab,
  SnapshotRecord,
  SnapshotScheduleResponse,
} from '@/modules/dental-management/presentation/reports/report-dashboard-types';
import { FilterLabel, MetricCard } from '@/modules/dental-management/presentation/reports/report-dashboard-utils';
import { formatCurrency } from '@/lib/currency-utils';
import { toast } from 'sonner';

const client = new AxiosClient();
type ReportFilterKey = 'dateRange' | 'dentist' | 'granularity' | 'patient' | 'paymentMethod' | 'search' | 'status' | 'treatment';
type RangePreset = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
type WorkflowAccessSummary = {
  capabilities: {
    canAccessAuditReports: boolean;
    canAccessClinicalReports: boolean;
    canAccessExecutiveReports: boolean;
    canAccessFinancialReports: boolean;
    canAccessFinancialSubreports: boolean;
    canAccessInventoryReports: boolean;
    canManageSnapshots: boolean;
  };
  requirements: Array<{ action: string; allowed: boolean; reason: string; requiredRight: string }>;
  user: {
    permissionCount: number;
    rightLevel: string;
    roles: string[];
  };
};

const reportExperience: Record<
  ReportTab,
  {
    defaultExport: CsvExportType;
    description: string;
    exportOptions: Array<{ label: string; value: CsvExportType }>;
    helperText: string;
    label: string;
    searchPlaceholder: string;
    visibleFilters: ReportFilterKey[];
  }
> = {
  audit: {
    defaultExport: 'audit_log',
    description: 'See who changed financial records, who opened reports, and when important snapshots were saved.',
    exportOptions: [{ label: 'Activity history', value: 'audit_log' }],
    helperText: 'Use this when you need to review staff activity, exports, and important report events.',
    label: 'Activity History',
    searchPlaceholder: 'Search by action, report name, staff name, or note',
    visibleFilters: ['dateRange', 'search'],
  },
  clinical: {
    defaultExport: 'clinical_treatment',
    description: 'Understand appointment outcomes, treatment volume, prescriptions, and implant follow-up.',
    exportOptions: [{ label: 'Treatment activity', value: 'clinical_treatment' }],
    helperText: 'Useful for dentists and supervisors who want to track workload and treatment progress.',
    label: 'Clinical Care',
    searchPlaceholder: 'Search by patient, treatment, medicine, or implant details',
    visibleFilters: ['dateRange', 'granularity', 'status', 'dentist', 'treatment', 'patient', 'search'],
  },
  executive: {
    defaultExport: 'executive_summary',
    description: 'Get a quick clinic summary for money received, unpaid balances, profit, and patient growth.',
    exportOptions: [{ label: 'Clinic summary', value: 'executive_summary' }],
    helperText: 'Best for owners and managers who want a fast picture of how the clinic is doing.',
    label: 'Clinic Overview',
    searchPlaceholder: 'Search by patient, invoice, treatment, or note',
    visibleFilters: ['dateRange', 'granularity', 'status', 'dentist', 'treatment', 'paymentMethod', 'patient', 'search'],
  },
  financial: {
    defaultExport: 'financial_revenue',
    description: 'Review income, unpaid balances, cash movement, and what treatments bring in the most money.',
    exportOptions: [
      { label: 'Income by treatment', value: 'financial_revenue' },
      { label: 'Unpaid invoices', value: 'financial_outstanding' },
      { label: 'Safe transactions', value: 'financial_daily_safe' },
      { label: 'Patient financial details', value: 'financial_patient_details' },
      { label: 'Shareholder ledger', value: 'financial_shareholder' },
      { label: 'Implant supplier payments', value: 'financial_implant_installment' },
    ],
    helperText: 'This report helps accounting and management follow collections, debts, and clinic spending.',
    label: 'Money and Collections',
    searchPlaceholder: 'Search by patient, invoice, payment note, or ledger entry',
    visibleFilters: ['dateRange', 'granularity', 'status', 'dentist', 'treatment', 'paymentMethod', 'patient', 'search'],
  },
  inventory: {
    defaultExport: 'inventory_stock',
    description: 'Check what is in stock, what is running low, and which treatments are using the most items.',
    exportOptions: [{ label: 'Stock list', value: 'inventory_stock' }],
    helperText: 'Use this to spot low stock early and understand which supplies are being consumed fastest.',
    label: 'Stock and Supplies',
    searchPlaceholder: 'Search by item, treatment, supplier, or patient name',
    visibleFilters: ['dateRange', 'granularity', 'treatment', 'search'],
  },
};

const escapeHtml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const defaultFilters = (): FiltersState => {
  const range = createDefaultReportRange(90);

  return {
    dentistFilter: 'all',
    endDate: range.endDate,
    granularity: 'month',
    patientFilter: 'all',
    paymentMethodFilter: 'all',
    search: '',
    startDate: range.startDate,
    statusFilter: 'all',
    treatmentFilter: 'all',
  };
};

const reportSelectClassName = 'h-8 rounded-md border bg-background px-3 text-sm';
const reportInputClassName = 'h-8';
const buildReportParams = (filters: FiltersState) => ({
  dentistFilter: filters.dentistFilter,
  endDate: filters.endDate,
  granularity: filters.granularity,
  patientFilter: filters.patientFilter,
  paymentMethodFilter: filters.paymentMethodFilter,
  search: filters.search,
  startDate: filters.startDate,
  statusFilter: filters.statusFilter,
  treatmentFilter: filters.treatmentFilter,
});

const areReportParamsEqual = (
  left: ReturnType<typeof buildReportParams>,
  right: ReturnType<typeof buildReportParams>,
): boolean => (
  left.dentistFilter === right.dentistFilter &&
  left.endDate === right.endDate &&
  left.granularity === right.granularity &&
  left.patientFilter === right.patientFilter &&
  left.paymentMethodFilter === right.paymentMethodFilter &&
  left.search === right.search &&
  left.startDate === right.startDate &&
  left.statusFilter === right.statusFilter &&
  left.treatmentFilter === right.treatmentFilter
);

const rangePresets: Record<RangePreset, { days: number | null; granularity: FiltersState['granularity']; label: string }> = {
  daily: { days: 0, granularity: 'day', label: 'Daily' },
  weekly: { days: 7, granularity: 'day', label: 'Weekly' },
  monthly: { days: 30, granularity: 'month', label: 'Monthly' },
  yearly: { days: 365, granularity: 'year', label: 'Yearly' },
  custom: { days: null, granularity: 'day', label: 'Custom range' },
};

const ReportsPage = (): JSX.Element => {
  const locale = useLocale();
  const tSidebar = useTranslations('sidebar');
  const router = useRouter();
  const printableReportRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>('executive');
  const [draftFilters, setDraftFilters] = useState<FiltersState>(() => defaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>(() => defaultFilters());
  const [summaryRange, setSummaryRange] = useState<RangePreset>('monthly');
  const [summaryRangeStart, setSummaryRangeStart] = useState(() => createDefaultReportRange(30).startDate);
  const [summaryRangeEnd, setSummaryRangeEnd] = useState(() => createDefaultReportRange(30).endDate);
  const [rangeSummary, setRangeSummary] = useState<FinancialData['summary'] | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptionsResponse | null>(null);
  const [executive, setExecutive] = useState<ExecutiveData | null>(null);
  const [financial, setFinancial] = useState<FinancialData | null>(null);
  const [clinical, setClinical] = useState<ClinicalData | null>(null);
  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [snapshotSchedule, setSnapshotSchedule] = useState<SnapshotScheduleResponse | null>(null);
  const [csvExportType, setCsvExportType] = useState<CsvExportType>('executive_summary');
  const [workflowAccess, setWorkflowAccess] = useState<WorkflowAccessSummary | null>(null);
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);
  const [isLoadingTab, setIsLoadingTab] = useState(false);
  const [isLoadingRangeSummary, setIsLoadingRangeSummary] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const activeReport = reportExperience[activeTab];
  const availableTabs = useMemo(() => {
    const capabilities = workflowAccess?.capabilities;
    return ([
      capabilities?.canAccessExecutiveReports !== false ? 'executive' : null,
      capabilities?.canAccessFinancialReports ? 'financial' : null,
      capabilities?.canAccessClinicalReports !== false ? 'clinical' : null,
      capabilities?.canAccessInventoryReports !== false ? 'inventory' : null,
      capabilities?.canAccessAuditReports ? 'audit' : null,
    ].filter(Boolean) as ReportTab[]);
  }, [workflowAccess]);

  const reportParams = useMemo(() => buildReportParams(appliedFilters), [appliedFilters]);
  const draftReportParams = useMemo(() => buildReportParams(draftFilters), [draftFilters]);
  const hasPendingFilterChanges = useMemo(
    () => !areReportParamsEqual(reportParams, draftReportParams),
    [draftReportParams, reportParams],
  );

  const fetchFilterOptions = useCallback(async (): Promise<void> => {
    setIsLoadingFilters(true);
    try {
      setFilterOptions(await fetchReport<FilterOptionsResponse>('/api/v1/dental-management/reports/filter-options', reportParams));
    } finally {
      setIsLoadingFilters(false);
    }
  }, [reportParams]);

  const fetchSnapshots = useCallback(async (): Promise<void> => {
    setSnapshots(await fetchReport<SnapshotRecord[]>('/api/v1/dental-management/reports/snapshots', { limit: 20, reportKey: 'executive' }));
  }, []);

  const fetchSnapshotSchedule = useCallback(async (): Promise<void> => {
    setSnapshotSchedule(await fetchReport<SnapshotScheduleResponse>('/api/v1/dental-management/reports/snapshot-schedule', { reportKey: 'executive' }));
  }, []);

  const fetchTab = useCallback(async (tab: ReportTab, params = reportParams): Promise<void> => {
    setIsLoadingTab(true);
    try {
      if (tab === 'executive') setExecutive(await fetchReport<ExecutiveData>('/api/v1/dental-management/reports/executive', params));
      if (tab === 'financial') setFinancial(await fetchReport<FinancialData>('/api/v1/dental-management/reports/financial', params));
      if (tab === 'clinical') setClinical(await fetchReport<ClinicalData>('/api/v1/dental-management/reports/clinical', params));
      if (tab === 'inventory') setInventory(await fetchReport<InventoryData>('/api/v1/dental-management/reports/inventory', params));
      if (tab === 'audit') setAudit(await fetchReport<AuditData>('/api/v1/dental-management/reports/audit', params));
    } finally {
      setIsLoadingTab(false);
    }
  }, [reportParams]);

  useEffect(() => {
    void fetchFilterOptions();
  }, [fetchFilterOptions]);

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

  useEffect(() => {
    void fetchTab(activeTab);
  }, [activeTab, fetchTab, reportParams]);

  useEffect(() => {
    if (availableTabs.length === 0) return;
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [activeTab, availableTabs]);

  useEffect(() => {
    if (!workflowAccess?.capabilities.canManageSnapshots) {
      setSnapshots([]);
      setSnapshotSchedule(null);
      return;
    }
    void Promise.all([fetchSnapshots(), fetchSnapshotSchedule()]);
  }, [fetchSnapshotSchedule, fetchSnapshots, workflowAccess]);

  useEffect(() => {
    if (!activeReport.exportOptions.some((option) => option.value === csvExportType)) {
      setCsvExportType(activeReport.defaultExport);
    }
  }, [activeReport, csvExportType]);

  useEffect(() => {
    if (workflowAccess && !workflowAccess.capabilities.canAccessFinancialReports) {
      setRangeSummary(null);
      setIsLoadingRangeSummary(false);
      return;
    }

    let isActive = true;
    const preset = rangePresets[summaryRange];
    const fallbackRange = createDefaultReportRange(preset.days ?? 30);
    const safeStart = summaryRangeStart || fallbackRange.startDate;
    const safeEnd = summaryRangeEnd || fallbackRange.endDate;
    const range = summaryRange === 'daily'
      ? { startDate: safeStart, endDate: safeStart }
      : preset.days === null
        ? { startDate: safeStart, endDate: safeEnd }
        : createDefaultReportRange(preset.days);
    const baseFilters = defaultFilters();
    const params = buildReportParams({
      ...baseFilters,
      endDate: range.endDate,
      granularity: preset.granularity,
      startDate: range.startDate,
    });

    setIsLoadingRangeSummary(true);
    void fetchReport<FinancialData>('/api/v1/dental-management/reports/financial', { ...params, summaryOnly: 1 })
      .then(async (data) => {
        if (!isActive) return;
        if (!data?.summary) {
          const fallback = await fetchReport<FinancialData>('/api/v1/dental-management/reports/financial', params);
          if (isActive) setRangeSummary(fallback?.summary ?? null);
          return;
        }
        setRangeSummary(data.summary);
      })
      .catch(() => {
        if (isActive) setRangeSummary(null);
      })
      .finally(() => {
        if (isActive) setIsLoadingRangeSummary(false);
      });

    return () => {
      isActive = false;
    };
  }, [summaryRange, summaryRangeEnd, summaryRangeStart, workflowAccess]);

  const applyFilters = (): void => {
    setAppliedFilters(draftFilters);
  };

  const openSafeLedger = (focus: 'balance' | 'in' | 'out'): void => {
    const endDate = summaryRange === 'daily' ? summaryRangeStart : summaryRangeEnd;
    const params = new URLSearchParams({
      endDate,
      focus,
      startDate: summaryRangeStart,
    });
    if (focus === 'in' || focus === 'out') {
      params.set('direction', focus);
    }
    router.push(`/${locale}/reports/safe?${params.toString()}`);
  };

  const showsFilter = (filterKey: ReportFilterKey): boolean => activeReport.visibleFilters.includes(filterKey);
  const hasPrintableContent = (
    (activeTab === 'executive' && executive !== null) ||
    (activeTab === 'financial' && financial !== null) ||
    (activeTab === 'clinical' && clinical !== null) ||
    (activeTab === 'inventory' && inventory !== null) ||
    (activeTab === 'audit' && audit !== null)
  );

  const handleExport = (): void => {
    const exportParams = draftReportParams;
    if (hasPendingFilterChanges) {
      setAppliedFilters(draftFilters);
    }

    void triggerReportExport(csvExportType, { ...exportParams, format: 'csv' })
      .then(() => {
        toast.success('CSV export downloaded with the current filters.');
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to export CSV.';
        toast.error(message);
      });
  };

  const handlePrintReport = (): void => {
    void (async () => {
      const printParams = draftReportParams;

      if (!hasPrintableContent && !hasPendingFilterChanges) {
        toast.error('Wait for the report to finish loading before printing.');
        return;
      }

      if (hasPendingFilterChanges) {
        setAppliedFilters(draftFilters);
        await fetchTab(activeTab, printParams);
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => resolve());
        });
      }

      if (printableReportRef.current === null) {
        toast.error('Unable to prepare the printable report.');
        return;
      }

      const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((node) => node.outerHTML)
        .join('\n');

      const selectedPatient = filterOptions?.patients.find((patient) => String(patient.id) === printParams.patientFilter)?.name;
      const selectedFilters = [
        `Report: ${activeReport.label}`,
        `Date range: ${printParams.startDate} to ${printParams.endDate}`,
        showsFilter('granularity') ? `View by: ${printParams.granularity}` : '',
        showsFilter('status') ? `Status: ${printParams.statusFilter === 'all' ? 'All statuses' : printParams.statusFilter}` : '',
        showsFilter('dentist') ? `Dentist: ${printParams.dentistFilter === 'all' ? 'All dentists' : printParams.dentistFilter}` : '',
        showsFilter('treatment') ? `Treatment: ${printParams.treatmentFilter === 'all' ? 'All treatments' : printParams.treatmentFilter}` : '',
        showsFilter('paymentMethod') ? `Payment method: ${printParams.paymentMethodFilter === 'all' ? 'All methods' : printParams.paymentMethodFilter}` : '',
        showsFilter('patient') ? `Patient: ${printParams.patientFilter === 'all' ? 'All patients' : (selectedPatient ?? printParams.patientFilter)}` : '',
        showsFilter('search') && printParams.search.trim() !== '' ? `Search: ${printParams.search.trim()}` : '',
      ].filter(Boolean);

      const printedAt = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date());

      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${escapeHtml(activeReport.label)}</title>
            ${styleTags}
            <style>
              body {
                background: #f8fafc;
                color: #0f172a;
                margin: 0;
                padding: 24px;
              }
              .report-print-shell {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 20px;
                margin: 0 auto;
                max-width: 1200px;
                padding: 24px;
              }
              .report-print-header {
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                flex-wrap: wrap;
                gap: 16px;
                justify-content: space-between;
                margin-bottom: 20px;
                padding-bottom: 16px;
              }
              .report-print-header h1 {
                font-size: 28px;
                margin: 0 0 8px;
              }
              .report-print-header p {
                color: #475569;
                margin: 0;
              }
              .report-print-meta {
                color: #475569;
                font-size: 12px;
                text-align: right;
              }
              .report-print-filters {
                display: grid;
                gap: 8px;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                margin-bottom: 20px;
              }
              .report-print-filter {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 10px 12px;
                font-size: 13px;
              }
              button,
              [data-print-hidden="true"] {
                display: none !important;
              }
              .recharts-responsive-container {
                min-height: 320px !important;
              }
              @media print {
                body {
                  background: #ffffff;
                  padding: 0;
                }
                .report-print-shell {
                  border: none;
                  border-radius: 0;
                  box-shadow: none;
                  max-width: none;
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            <main class="report-print-shell">
              <header class="report-print-header">
                <div>
                  <h1>${escapeHtml(activeReport.label)}</h1>
                  <p>${escapeHtml(activeReport.description)}</p>
                </div>
                <div class="report-print-meta">
                  <div>Printed: ${escapeHtml(printedAt)}</div>
                  <div>Use your browser print dialog to save this as PDF.</div>
                </div>
              </header>
              <section class="report-print-filters">
                ${selectedFilters.map((item) => `<div class="report-print-filter">${escapeHtml(item)}</div>`).join('')}
              </section>
              <section>
                ${printableReportRef.current.innerHTML}
              </section>
            </main>
          </body>
        </html>
      `;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.append(iframe);

      const printDocument = iframe.contentWindow?.document;
      const printWindow = iframe.contentWindow;
      if (!printDocument || !printWindow) {
        iframe.remove();
        toast.error('Unable to prepare the printable report.');
        return;
      }

      printDocument.open();
      printDocument.write(html);
      printDocument.close();

      const cleanup = (): void => {
        setTimeout(() => {
          iframe.remove();
        }, 0);
      };

      printWindow.onafterprint = cleanup;
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 160);
    })().catch(() => {
      toast.error('Failed to prepare the printable report.');
    });
  };

  const captureSnapshot = (): void => {
    if (!workflowAccess?.capabilities.canManageSnapshots) {
      toast.error('Approval access is required to manage report snapshots.');
      return;
    }
    setIsSavingSnapshot(true);
    void client
      .post('/api/v1/dental-management/reports/snapshots', {
        filters: reportParams,
        reason: 'manual',
        reportKey: 'executive',
      })
      .then(async () => {
        await fetchSnapshots();
        toast.success('Executive snapshot captured.');
      })
      .catch(() => {
        toast.error('Failed to capture executive snapshot.');
      })
      .finally(() => {
        setIsSavingSnapshot(false);
      });
  };

  const saveSnapshotSchedule = (): void => {
    if (!snapshotSchedule) return;
    if (!workflowAccess?.capabilities.canManageSnapshots) {
      toast.error('Approval access is required to manage report snapshots.');
      return;
    }

    setIsSavingSchedule(true);
    void client
      .put('/api/v1/dental-management/reports/snapshot-schedule', {
        cadence: snapshotSchedule.cadence,
        filters: reportParams,
        reportKey: 'executive',
      })
      .then(async () => {
        await fetchSnapshotSchedule();
        toast.success('Snapshot schedule updated.');
      })
      .catch(() => {
        toast.error('Failed to update snapshot schedule.');
      })
      .finally(() => {
        setIsSavingSchedule(false);
      });
  };

  const renderContent = (): JSX.Element | null => {
    if (activeTab === 'executive') return executive ? (
      <ExecutiveReportPanel
        data={executive}
        isSavingSchedule={isSavingSchedule}
        isSavingSnapshot={isSavingSnapshot}
        locale={locale}
        onCaptureSnapshot={captureSnapshot}
        onScheduleChange={(cadence) => setSnapshotSchedule((prev) => prev ? { ...prev, cadence } : prev)}
        onSaveSchedule={saveSnapshotSchedule}
        schedule={snapshotSchedule}
        snapshots={snapshots}
      />
    ) : null;
    if (activeTab === 'financial') return financial ? <FinancialReportPanel data={financial} /> : null;
    if (activeTab === 'clinical') return clinical ? <ClinicalReportPanel data={clinical} /> : null;
    if (activeTab === 'inventory') return inventory ? <InventoryReportPanel data={inventory} /> : null;
    if (activeTab === 'audit') return audit ? <AuditReportPanel data={audit} locale={locale} /> : null;
    return null;
  };

  return (
    <>
      <Header breadcrumbs={[{ id: 'reports', isCurrent: true, label: tSidebar('reports.title') }]} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <Card className="rounded-3xl border border-slate-200 bg-white/80">
              <CardHeader className="pb-3">
                <CardTitle>Quick Financial Snapshot</CardTitle>
                <CardDescription>Choose a time range and review the headline money metrics.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-0.5">
                    <FilterLabel>Range</FilterLabel>
                    <select
                      className={reportSelectClassName}
                      value={summaryRange}
                      onChange={(event) => {
                        const next = event.target.value as RangePreset;
                        setSummaryRange(next);
                        const preset = rangePresets[next];
                        if (preset.days !== null) {
                          const range = createDefaultReportRange(preset.days);
                          setSummaryRangeStart(range.startDate);
                          setSummaryRangeEnd(range.endDate);
                        }
                      }}
                    >
                      {Object.entries(rangePresets).map(([value, preset]) => (
                        <option key={value} value={value}>{preset.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <FilterLabel>{summaryRange === 'daily' ? 'Date' : 'From'}</FilterLabel>
                    <Input
                      className={reportInputClassName}
                      type="date"
                      value={summaryRangeStart}
                      onChange={(event) => {
                        setSummaryRangeStart(event.target.value);
                        if (summaryRange === 'daily') {
                          setSummaryRangeEnd(event.target.value);
                        } else {
                          setSummaryRange('custom');
                        }
                      }}
                    />
                  </div>
                  {summaryRange !== 'daily' ? (
                    <div className="flex flex-col gap-0.5">
                      <FilterLabel>To</FilterLabel>
                      <Input
                        className={reportInputClassName}
                        type="date"
                        value={summaryRangeEnd}
                        onChange={(event) => {
                          setSummaryRangeEnd(event.target.value);
                          setSummaryRange('custom');
                        }}
                      />
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Showing {rangePresets[summaryRange].label.toLowerCase()} totals.
                  </p>
                </div>

                {!workflowAccess?.capabilities.canAccessFinancialReports && workflowAccess ? (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                    Financial summary widgets are hidden until a user has at least `review` access.
                  </div>
                ) : isLoadingRangeSummary && !rangeSummary ? (
                  <LoadingState compact title="Loading summary" description="Fetching totals for the selected range." />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      label="Total money received"
                      value={formatCurrency(rangeSummary?.paid ?? 0, 'AFN')}
                      tone="safe"
                    />
                    <MetricCard
                      label="Total debts"
                      value={formatCurrency(rangeSummary?.outstanding ?? 0, 'AFN')}
                      tone="danger"
                    />
                    <MetricCard
                      label="Total unpaid money"
                      value={formatCurrency(rangeSummary?.thirdCompanyUnpaid ?? 0, 'AFN')}
                    />
                    <div className="space-y-3">
                      <button
                        type="button"
                        className="text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                        onClick={() => openSafeLedger('balance')}
                      >
                        <MetricCard
                          label="Total safe money"
                          value={formatCurrency(rangeSummary?.safeBalance ?? 0, 'AFN')}
                          tone="safe"
                        />
                      </button>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                        <button
                          type="button"
                          className="text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                          onClick={() => openSafeLedger('in')}
                        >
                          <MetricCard
                            label="Safe money in"
                            value={formatCurrency(rangeSummary?.safeIn ?? 0, 'AFN')}
                          />
                        </button>
                        <button
                          type="button"
                          className="text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                          onClick={() => openSafeLedger('out')}
                        >
                          <MetricCard
                            label="Safe money out"
                            value={formatCurrency(rangeSummary?.safeOut ?? 0, 'AFN')}
                            tone="danger"
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-background to-cyan-50">
              <CardHeader className="pb-3">
                <CardTitle>Reports Center</CardTitle>
                <CardDescription>Choose a date range, apply the filters you need, and read the results in plain clinic language.</CardDescription>
              </CardHeader>
              <CardContent className="grid items-start gap-3 lg:grid-cols-[1.6fr_1fr]">
                <div className="grid auto-rows-min items-start content-start gap-2 md:grid-cols-3 xl:grid-cols-5">
                  {showsFilter('dateRange') ? (
                    <>
                      <div className="flex flex-col gap-0.5 self-start">
                        <FilterLabel>From</FilterLabel>
                        <Input className={reportInputClassName} type="date" value={draftFilters.startDate} onChange={(event) => setDraftFilters((prev) => ({ ...prev, startDate: event.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-0.5 self-start">
                        <FilterLabel>To</FilterLabel>
                        <Input className={reportInputClassName} type="date" value={draftFilters.endDate} onChange={(event) => setDraftFilters((prev) => ({ ...prev, endDate: event.target.value }))} />
                      </div>
                    </>
                  ) : null}
                  {showsFilter('granularity') ? (
                    <div className="flex flex-col gap-0.5 self-start">
                      <FilterLabel>Show data by</FilterLabel>
                      <select className={reportSelectClassName} value={draftFilters.granularity} onChange={(event) => setDraftFilters((prev) => ({ ...prev, granularity: event.target.value as FiltersState['granularity'] }))}>
                        <option value="day">Day</option>
                        <option value="month">Month</option>
                        <option value="year">Year</option>
                      </select>
                    </div>
                  ) : null}
                  {showsFilter('status') ? (
                    <div className="flex flex-col gap-0.5 self-start">
                      <FilterLabel>Appointment status</FilterLabel>
                      <select className={reportSelectClassName} value={draftFilters.statusFilter} onChange={(event) => setDraftFilters((prev) => ({ ...prev, statusFilter: event.target.value as FiltersState['statusFilter'] }))}>
                        <option value="all">All statuses</option>
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  ) : null}
                  {showsFilter('dentist') ? (
                    <div className="flex flex-col gap-0.5 self-start">
                      <FilterLabel>Dentist</FilterLabel>
                      <select className={reportSelectClassName} value={draftFilters.dentistFilter} onChange={(event) => setDraftFilters((prev) => ({ ...prev, dentistFilter: event.target.value }))}>
                        <option value="all">All dentists</option>
                        {(filterOptions?.dentists ?? []).map((dentist) => (
                          <option key={dentist} value={dentist}>{dentist}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {showsFilter('treatment') ? (
                    <div className="flex flex-col gap-0.5 self-start">
                      <FilterLabel>Treatment</FilterLabel>
                      <select className={reportSelectClassName} value={draftFilters.treatmentFilter} onChange={(event) => setDraftFilters((prev) => ({ ...prev, treatmentFilter: event.target.value }))}>
                        <option value="all">All treatments</option>
                        {(filterOptions?.treatments ?? []).map((treatment) => (
                          <option key={treatment} value={treatment}>{treatment}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {showsFilter('paymentMethod') ? (
                    <div className="flex flex-col gap-0.5 self-start">
                      <FilterLabel>How the patient paid</FilterLabel>
                      <select className={reportSelectClassName} value={draftFilters.paymentMethodFilter} onChange={(event) => setDraftFilters((prev) => ({ ...prev, paymentMethodFilter: event.target.value }))}>
                        <option value="all">All payment methods</option>
                        {(filterOptions?.paymentMethods ?? []).map((method) => (
                          <option key={method} value={method}>{method}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {showsFilter('patient') ? (
                    <div className="flex flex-col gap-0.5 self-start">
                      <FilterLabel>Patient</FilterLabel>
                      <select className={reportSelectClassName} value={draftFilters.patientFilter} onChange={(event) => setDraftFilters((prev) => ({ ...prev, patientFilter: event.target.value }))}>
                        <option value="all">All patients</option>
                        {(filterOptions?.patients ?? []).map((patient) => (
                          <option key={String(patient.id)} value={String(patient.id)}>{patient.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {showsFilter('search') ? (
                    <div className="flex flex-col gap-0.5 self-start md:col-span-2">
                      <FilterLabel>Find something specific</FilterLabel>
                      <Input className={reportInputClassName} value={draftFilters.search} onChange={(event) => setDraftFilters((prev) => ({ ...prev, search: event.target.value }))} placeholder={activeReport.searchPlaceholder} />
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-2 self-start rounded-2xl border bg-background/80 p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{activeReport.label}</p>
                    <p className="text-sm text-muted-foreground">{activeReport.description}</p>
                    <p className="text-xs text-muted-foreground">{activeReport.helperText}</p>
                    {workflowAccess ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Badge variant="outline">Right: {workflowAccess.user.rightLevel}</Badge>
                        {workflowAccess.user.roles.length > 0 ? <Badge variant="outline">Roles: {workflowAccess.user.roles.join(', ')}</Badge> : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <FilterLabel>Download this report</FilterLabel>
                    <select className={reportSelectClassName} value={csvExportType} onChange={(event) => setCsvExportType(event.target.value as CsvExportType)}>
                      {activeReport.exportOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <Button type="button" onClick={handleExport}>Download CSV</Button>
                  <Button type="button" variant="outline" onClick={handlePrintReport} disabled={!hasPrintableContent || isLoadingTab}>
                    Print / Save PDF
                  </Button>
                  <Button type="button" variant="outline" onClick={applyFilters} disabled={isLoadingFilters || isLoadingTab}>
                    {isLoadingFilters || isLoadingTab ? 'Updating report...' : 'Update report'}
                  </Button>
                  <p className="text-xs text-muted-foreground">Filters apply across the report tabs you are allowed to access.</p>
                </div>
              </CardContent>
            </Card>

            {workflowAccess ? (
              <Card className="rounded-3xl border border-slate-200 bg-slate-50/70">
                <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">Workflow restrictions</p>
                    <p className="text-muted-foreground">Financial reports need `review` access. Audit reports, snapshot controls, and close-day style approvals need `approval` access.</p>
                  </div>
                  <div className="space-y-1 text-muted-foreground">
                    {workflowAccess.requirements.slice(0, 3).map((item) => (
                      <p key={item.action}>{item.action}: {item.allowed ? 'Allowed' : `Needs ${item.requiredRight}`}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ReportTab)} className="space-y-4">
              <TabsList className="w-full justify-start overflow-auto">
                {availableTabs.includes('executive') ? <TabsTrigger value="executive">{reportExperience.executive.label}</TabsTrigger> : null}
                {availableTabs.includes('financial') ? <TabsTrigger value="financial">{reportExperience.financial.label}</TabsTrigger> : null}
                {availableTabs.includes('clinical') ? <TabsTrigger value="clinical">{reportExperience.clinical.label}</TabsTrigger> : null}
                {availableTabs.includes('inventory') ? <TabsTrigger value="inventory">{reportExperience.inventory.label}</TabsTrigger> : null}
                {availableTabs.includes('audit') ? <TabsTrigger value="audit">{reportExperience.audit.label}</TabsTrigger> : null}
              </TabsList>

              <TabsContent value={activeTab}>
                <div ref={printableReportRef} className="space-y-4">
                  {isLoadingTab ? (
                    <LoadingState compact title="Refreshing report" description="Fetching server-rendered report sections." />
                  ) : (
                    renderContent()
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReportsPage;
