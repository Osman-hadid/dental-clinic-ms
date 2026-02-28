'use client';

import { type ChangeEvent, type FormEvent, JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utilities';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import {
  useCreateInvoice,
  useGetVisit,
  useInvoiceList,
  useVisitList,
  useVisitTreatmentList,
} from '@/modules/dental-management/presentation/hooks';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

type VisitInvoiceFormState = {
  discount: string;
  invoiceDate: string;
  netAmount: string;
  notes: string;
  paymentType: string;
  status: string;
};

type VisitAmountSummary = {
  inputTotal: number;
};

const createDefaultFormState = (invoiceDate: string): VisitInvoiceFormState => ({
  discount: '0',
  invoiceDate,
  netAmount: '0',
  notes: '',
  paymentType: 'cash',
  status: 'unpaid',
});

const asText = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return String(value).trim();
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return '';
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const parseCurrency = (value: unknown): number => {
  const text = asText(value);
  if (!text) {
    return 0;
  }
  const normalized = text.replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseImagePriceFromNotes = (notes: unknown): number => {
  const text = asText(notes);
  if (!text) {
    return 0;
  }

  const imageRequiredMatch = text.match(/\[image:([01])\]/i);
  if (!imageRequiredMatch || imageRequiredMatch[1] !== '1') {
    return 0;
  }

  const imagePriceMatch = text.match(/\[imagePrice:([0-9]+(?:\.[0-9]+)?)\]/i);
  if (!imagePriceMatch) {
    return 0;
  }

  const parsed = Number(imagePriceMatch[1]);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseNumericTagFromNotes = (notes: unknown, tag: string): number => {
  const text = asText(notes);
  if (!text) {
    return 0;
  }

  const match = text.match(new RegExp(`\\[${tag}:([0-9]+(?:\\.[0-9]+)?)\\]`, 'i'));
  if (!match) {
    return 0;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: number): string => roundCurrency(value).toFixed(2);

const getVisitInvoiceStatuses = (visit: Visit): string[] => {
  if (!Array.isArray(visit.invoices)) {
    return [];
  }

  return visit.invoices
    .map((invoice) => {
      if (!invoice || typeof invoice !== 'object') {
        return '';
      }

      const status = asText((invoice as Record<string, unknown>).status);
      return status.toLowerCase();
    })
    .filter((status) => status.length > 0);
};

const isVisitPaid = (visit: Visit): boolean => {
  const invoiceStatuses = getVisitInvoiceStatuses(visit);
  if (invoiceStatuses.length === 0) {
    return false;
  }

  return invoiceStatuses.includes('paid');
};

const getInvoiceSourceVisitIds = (sourceVisitIds: unknown): string[] => {
  if (!Array.isArray(sourceVisitIds)) {
    return [];
  }

  return sourceVisitIds
    .map((sourceVisitId) => asText(sourceVisitId))
    .filter((sourceVisitId) => sourceVisitId.length > 0);
};

const resolvePersonName = (
  fallbackLabel?: string,
  relation?: Record<string, unknown>,
  fallbackId?: string
): string => {
  if (fallbackLabel && fallbackLabel.trim()) {
    return fallbackLabel.trim();
  }

  if (relation) {
    const firstName = asText(relation.firstName ?? relation.first_name);
    const lastName = asText(relation.lastName ?? relation.last_name);
    const builtName = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (builtName) {
      return builtName;
    }
    const other = asText(relation.fullName ?? relation.full_name ?? relation.name);
    if (other) {
      return other;
    }
  }

  if (fallbackId) {
    return `#${fallbackId}`;
  }

  return '-';
};

const formatVisitLabel = (visit: Visit): string => {
  if (visit.tag && visit.tag.trim()) {
    return visit.tag.trim();
  }
  return `Visit #${visit.id}`;
};

const formatDate = (value?: string): string => {
  if (!value) {
    return '-';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(parsed);
};

const inputClass =
  'h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-ring/50';
const textAreaClass =
  'min-h-[80px] w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-ring/50';
const paymentClient = new AxiosClient();

export const InvoiceVisitSyncPanel = (): JSX.Element => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParameters = useSearchParams();
  const requestedVisitId = asText(searchParameters.get('visitId'));
  const flowSource = asText(searchParameters.get('flow')).toLowerCase();
  const isChartFlow = flowSource === 'chart';
  const hasProcessedRequestedVisit = useRef(false);
  const [formState, setFormState] = useState<VisitInvoiceFormState>(() =>
    createDefaultFormState(new Date().toISOString().slice(0, 10))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVisitIds, setSelectedVisitIds] = useState<number[]>([]);
  const { entities: visits, isFetching: isLoadingVisits, refetch } = useVisitList(
    1,
    8,
    '',
    [],
    ['patient', 'dentist', 'invoices']
  );
  const { data: requestedVisitResponse, isFetching: isLoadingRequestedVisit } = useGetVisit(
    requestedVisitId,
    { enabled: requestedVisitId.length > 0 }
  );
  const {
    entities: invoices,
    isFetching: isLoadingInvoices,
    refetch: refetchInvoices,
  } = useInvoiceList(1, 100, '', [], []);
  const createInvoice = useCreateInvoice();
  const [isNetAmountEdited, setIsNetAmountEdited] = useState(false);
  const t = useTranslations('invoice');

  const requestedVisit = requestedVisitResponse?.data;
  const visitPreview = useMemo(() => {
    const baseVisits = visits.slice(0, 8);

    if (!requestedVisit) {
      return baseVisits;
    }

    const requestedId = String(requestedVisit.id);
    const isAlreadyVisible = baseVisits.some((visit) => String(visit.id) === requestedId);
    if (isAlreadyVisible) {
      return baseVisits;
    }

    return [requestedVisit, ...baseVisits];
  }, [requestedVisit, visits]);
  const visitPreviewIds = useMemo(() => visitPreview.map((visit) => String(visit.id)), [visitPreview]);
  const linkedVisitIds = useMemo(() => {
    const ids = new Set<string>();

    for (const invoice of invoices) {
      const status = asText(invoice.status).toLowerCase();
      if (status === 'cancelled') {
        continue;
      }

      const primaryVisitId = asText(invoice.visitId);
      if (primaryVisitId) {
        ids.add(primaryVisitId);
      }

      for (const sourceVisitId of getInvoiceSourceVisitIds(invoice.sourceVisitIds)) {
        ids.add(sourceVisitId);
      }
    }

    return ids;
  }, [invoices]);
  const unpaidVisits = useMemo(
    () =>
      visitPreview.filter((visit) => {
        const visitId = asText(visit.id);
        if (linkedVisitIds.has(visitId)) {
          return false;
        }

        return !isVisitPaid(visit);
      }),
    [linkedVisitIds, visitPreview]
  );
  const hasVisits = unpaidVisits.length > 0;

  const selectedVisitSet = useMemo(
    () => new Set(selectedVisitIds.map((id) => String(id))),
    [selectedVisitIds]
  );
  const selectableVisitSet = useMemo(
    () => new Set(unpaidVisits.map((visit) => String(visit.id))),
    [unpaidVisits]
  );
  const selectedVisits = useMemo(
    () => unpaidVisits.filter((visit) => selectedVisitSet.has(String(visit.id))),
    [selectedVisitSet, unpaidVisits]
  );

  const visitTreatmentFilters = useMemo(
    () => ({
      visitId: visitPreviewIds.length > 0 ? visitPreviewIds : ['-1'],
    }),
    [visitPreviewIds]
  );
  const {
    entities: visitTreatments,
    isFetching: isLoadingVisitAmounts,
    refetch: refetchVisitTreatments,
  } = useVisitTreatmentList(1, 100, '', [], [], visitTreatmentFilters);

  const visitAmountsById = useMemo(() => {
    const totals = new Map<string, number>();
    for (const visitId of visitPreviewIds) {
      totals.set(visitId, 0);
    }

    for (const treatment of visitTreatments) {
      const visitId = asText(treatment.visitId);
      const currentVisitTotal = totals.get(visitId);
      if (currentVisitTotal === undefined) {
        continue;
      }

      const treatmentCharge = parseCurrency(treatment.price);
      const treatmentChargeInputFromNotes = parseNumericTagFromNotes(treatment.notes, 'priceInput');
      const treatmentChargeInput = treatmentChargeInputFromNotes > 0
        ? treatmentChargeInputFromNotes
        : treatmentCharge;

      const imageCharge = parseImagePriceFromNotes(treatment.notes);
      const imageChargeInputFromNotes = parseNumericTagFromNotes(treatment.notes, 'imagePriceInput');
      const imageChargeInput = imageChargeInputFromNotes > 0
        ? imageChargeInputFromNotes
        : imageCharge;

      totals.set(visitId, roundCurrency(currentVisitTotal + treatmentChargeInput + imageChargeInput));
    }

    const summaryMap = new Map<string, VisitAmountSummary>();
    for (const [visitId, inputTotal] of totals.entries()) {
      summaryMap.set(visitId, {
        inputTotal: roundCurrency(inputTotal),
      });
    }

    return summaryMap;
  }, [visitPreviewIds, visitTreatments]);

  const combinedTotal = useMemo(() => {
    return selectedVisits.reduce((sum, visit) => {
      const amount = visitAmountsById.get(String(visit.id))?.inputTotal ?? 0;
      return roundCurrency(sum + amount);
    }, 0);
  }, [selectedVisits, visitAmountsById]);
  const selectedCount = selectedVisits.length;
  const appliedDiscount = Math.max(0, roundCurrency(parseCurrency(formState.discount)));
  const invoiceNetAmount = Math.max(0, roundCurrency(combinedTotal - appliedDiscount));
  const requestedPaidNowAmount = Math.max(0, roundCurrency(parseCurrency(formState.netAmount)));
  const paidNowAmount = Math.min(
    invoiceNetAmount,
    requestedPaidNowAmount
  );
  const debtAmount = Math.max(0, roundCurrency(invoiceNetAmount - paidNowAmount));

  const resetForm = (): void => {
    setIsNetAmountEdited(false);
    setFormState(createDefaultFormState(new Date().toISOString().slice(0, 10)));
  };

  const toggleVisitSelection = (visitId: number): void => {
    if (!selectableVisitSet.has(String(visitId))) {
      return;
    }

    setIsNetAmountEdited(false);
    setSelectedVisitIds((previous) => {
      if (previous[0] === visitId) {
        return [];
      }
      return [visitId];
    });
  };

  const handleClearSelection = (): void => {
    setSelectedVisitIds([]);
    resetForm();
  };

  const updateField = (field: keyof VisitInvoiceFormState) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ): void => {
    const value = event.target.value;
    if (field === 'netAmount') {
      setIsNetAmountEdited(true);
    }
    setFormState((previous) => ({ ...previous, [field]: value }));
  };

  useEffect(() => {
    setSelectedVisitIds((previous) => {
      if (previous.length === 0) {
        return previous;
      }

      const allowedVisitIds = new Set(unpaidVisits.map((visit) => String(visit.id)));
      const next = previous.filter((id) => allowedVisitIds.has(String(id)));
      const isUnchanged =
        next.length === previous.length &&
        next.every((id, index) => id === previous[index]);

      return isUnchanged ? previous : next;
    });
  }, [unpaidVisits]);

  useEffect(() => {
    if (isNetAmountEdited) {
      return;
    }

    setFormState((previous) => {
      const nextValue = formatMoney(invoiceNetAmount);
      if (previous.netAmount === nextValue) {
        return previous;
      }
      return { ...previous, netAmount: nextValue };
    });
  }, [invoiceNetAmount, isNetAmountEdited]);

  const clearRequestedVisitQuery = useCallback((): void => {
    if (!searchParameters.get('flow') && !searchParameters.get('visitId')) {
      return;
    }

    const nextParameters = new URLSearchParams(searchParameters.toString());
    nextParameters.delete('flow');
    nextParameters.delete('visitId');
    const nextQuery = nextParameters.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParameters]);

  useEffect(() => {
    if (hasProcessedRequestedVisit.current) {
      return;
    }

    if (!requestedVisitId) {
      return;
    }

    if (isLoadingVisits || isLoadingInvoices || isLoadingRequestedVisit) {
      return;
    }

    hasProcessedRequestedVisit.current = true;
    const parsedVisitId = Number(requestedVisitId);
    const isSelectable = selectableVisitSet.has(requestedVisitId);

    if (Number.isNaN(parsedVisitId) || !isSelectable) {
      if (isChartFlow) {
        toast.error('This visit is already billed or unavailable for billing.');
      }
      clearRequestedVisitQuery();
      return;
    }

    setIsNetAmountEdited(false);
    setSelectedVisitIds((previous) => {
      if (previous.length === 1 && previous[0] === parsedVisitId) {
        return previous;
      }
      return [parsedVisitId];
    });

    if (isChartFlow) {
      toast.success('Payment details are ready. Complete the form to issue the invoice.');
    }

    clearRequestedVisitQuery();
  }, [
    clearRequestedVisitQuery,
    isChartFlow,
    isLoadingInvoices,
    isLoadingRequestedVisit,
    isLoadingVisits,
    requestedVisitId,
    selectableVisitSet,
  ]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (selectedVisits.length === 0) {
      toast.error(t('config.sync.selectVisitFirst'));
      return;
    }

    const firstSelectedVisit = selectedVisits[0];

    if (appliedDiscount - combinedTotal > 0.01) {
      toast.error(t('config.sync.discountTooHigh'));
      return;
    }
    if (requestedPaidNowAmount > invoiceNetAmount + 0.01) {
      toast.error('Paid amount cannot exceed invoice net amount.');
      return;
    }
    const linkedVisitLabels = selectedVisits.map((visit) => formatVisitLabel(visit)).join(', ');
    const linkedVisitSegment = `${t('config.sync.linkedVisitsNote')}: ${linkedVisitLabels}`;
    const mergedNotes = [formState.notes.trim(), linkedVisitSegment].filter(Boolean).join(' | ');

    setIsSubmitting(true);

    try {
      const patientIdNumber = Number(firstSelectedVisit.patientId);
      const effectiveStatus = formState.status === 'cancelled'
        ? 'cancelled'
        : (debtAmount <= 0 ? 'paid' : (paidNowAmount > 0 ? 'partially_paid' : 'unpaid'));
      const payload = {
        currency: 'AFN',
        discount: appliedDiscount,
        exchangeRate: 1,
        invoiceDate: formState.invoiceDate || new Date().toISOString().slice(0, 10),
        netAmount: invoiceNetAmount,
        notes: mergedNotes.slice(0, 255) || undefined,
        patientId: Number.isNaN(patientIdNumber)
          ? firstSelectedVisit.patientId
          : patientIdNumber,
        paymentType: formState.paymentType,
        sourceVisitIds: [Number(firstSelectedVisit.id)],
        status: effectiveStatus,
        totalAmount: combinedTotal,
        visitId: Number(firstSelectedVisit.id),
      };

      const response = await createInvoice.mutateAsync(payload);
      if (response.success) {
        const createdInvoiceId = Number(response.data?.id);
        if (paidNowAmount > 0 && Number.isFinite(createdInvoiceId)) {
          const paymentMethod = formState.paymentType === 'card'
            ? 'card'
            : (formState.paymentType === 'insurance' ? 'insurance' : 'cash');
          try {
            await paymentClient.get('/sanctum/csrf-cookie');
            await paymentClient.post('/api/v1/dental-management/payments', {
              amount: paidNowAmount.toFixed(2),
              currency: 'AFN',
              exchangeRate: 1,
              invoiceId: createdInvoiceId,
              method: paymentMethod,
              notes: 'Initial payment from invoice creation.',
              paymentDate: payload.invoiceDate,
            });
          } catch {
            toast.error('Invoice created, but initial payment could not be saved.');
          }
        }

        toast.success(t('config.presentation.createSuccess', { entity: t('config.entity') }));
        handleClearSelection();
        await Promise.all([refetch(), refetchVisitTreatments(), refetchInvoices()]);
        return;
      }

      toast.error(
        response.error?.message ??
          response.message ??
          t('config.repository.createFailed', { entity: t('config.entity') })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = selectedVisits.length > 0 && !isSubmitting;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t('config.sync.title')}</CardTitle>
          <CardDescription>{t('config.sync.description')}</CardDescription>
        </div>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              void Promise.all([refetch(), refetchVisitTreatments(), refetchInvoices()]);
            }}
            disabled={isLoadingVisits || isLoadingVisitAmounts || isLoadingInvoices}
          >
            {isLoadingVisits || isLoadingVisitAmounts || isLoadingInvoices ? (
              <Loader2 className="mr-2 inline size-4 animate-spin" />
            ) : null}
            {t('config.sync.refresh')}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoadingVisits ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>{t('config.sync.loadingVisits')}</span>
          </div>
        ) : hasVisits ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold">{t('config.sync.unpaidVisits')}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {unpaidVisits.length > 0 ? (
                  unpaidVisits.map((visit) => {
                    const visitId = String(visit.id);
                    const isSelected = selectedVisitSet.has(visitId);
                    const visitAmountSummary = visitAmountsById.get(visitId);
                    const visitAmount = visitAmountSummary?.inputTotal ?? 0;
                    return (
                      <div
                        key={`visit-card-unpaid-${visit.id}`}
                        className={cn(
                          'flex flex-col gap-3 rounded-xl border bg-background p-4 transition duration-150',
                          isSelected
                            ? 'border-primary ring-2 ring-primary/30 shadow-lg'
                            : 'border-border/70 hover:border-primary/80'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <p className="font-semibold text-foreground">{formatVisitLabel(visit)}</p>
                          <span className="text-xs text-muted-foreground">{formatDate(visit.visitDate)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Patient: {resolvePersonName(visit.patientName, visit.patient, visit.patientId)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Dentist: {resolvePersonName(visit.dentistName, visit.dentist, visit.dentistId)}
                        </p>
                        <p className="text-xs font-medium text-foreground">
                          {t('config.sync.visitAmount')}:{' '}
                          {isLoadingVisitAmounts ? '-' : `${formatMoney(visitAmount)} AFN`}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant={isSelected ? 'secondary' : 'outline'}
                          onClick={() => {
                            toggleVisitSelection(Number(visit.id));
                          }}
                          disabled={isLoadingVisits || isSubmitting}
                        >
                          {isSelected
                            ? t('config.sync.selectedVisitButton')
                            : t('config.sync.selectVisitButton')}
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    {t('config.sync.noUnpaidVisits')}
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            {t('config.sync.noUnpaidVisits')}
          </div>
        )}

        <div className="space-y-4 rounded-xl border border-border/70 bg-muted/10 p-4">
          <div className="grid gap-2 md:grid-cols-4">
            <p className="text-sm font-semibold">
              {t('config.sync.selectedCount')}: <span>{selectedCount}</span>
            </p>
            <p className="text-sm font-semibold">
              {t('config.sync.combinedAmount')}: <span>{formatMoney(combinedTotal)} AFN</span>
            </p>
            <p className="text-sm font-semibold">
              {t('config.sync.form.netAmount')}: <span>{formatMoney(paidNowAmount)} AFN</span>
            </p>
            <p className="text-sm font-semibold">
              Debt: <span>{formatMoney(debtAmount)} AFN</span>
            </p>
          </div>

          {selectedVisits.length > 0 ? (
            <div className="space-y-2 text-xs text-muted-foreground">
              {selectedVisits.map((visit) => (
                <p key={`selected-visit-${visit.id}`}>
                  {formatVisitLabel(visit)} ({formatDate(visit.visitDate)}) - {formatMoney(
                    visitAmountsById.get(String(visit.id))?.inputTotal ?? 0
                  )} AFN
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t('config.sync.noVisitSelected')}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1 text-xs">
                <label className="font-semibold">{t('config.sync.form.totalAmount')}</label>
                <Input type="number" value={formatMoney(combinedTotal)} readOnly />
              </div>
              <div className="space-y-1 text-xs">
                <label className="font-semibold">{t('config.sync.form.discount')}</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.discount}
                  onChange={updateField('discount')}
                  disabled={selectedVisits.length === 0}
                />
              </div>
              <div className="space-y-1 text-xs">
                <label className="font-semibold">{t('config.sync.form.netAmount')}</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.netAmount}
                  onChange={updateField('netAmount')}
                  disabled={selectedVisits.length === 0}
                />
                <p className="text-[11px] text-muted-foreground">
                  This is treated as paid now. Remaining debt: {formatMoney(debtAmount)} AFN.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1 text-xs">
                <label className="font-semibold">{t('config.form.status.label')}</label>
                <select
                  className={inputClass}
                  value={formState.status}
                  onChange={updateField('status')}
                  disabled={selectedVisits.length === 0}
                >
                  <option value="unpaid">{t('config.form.status.options.unpaid')}</option>
                  <option value="partially_paid">
                    {t('config.form.status.options.partially_paid')}
                  </option>
                  <option value="paid">{t('config.form.status.options.paid')}</option>
                  <option value="cancelled">{t('config.form.status.options.cancelled')}</option>
                </select>
              </div>
              <div className="space-y-1 text-xs">
                <label className="font-semibold">{t('config.sync.form.paymentType')}</label>
                <select
                  className={inputClass}
                  value={formState.paymentType}
                  onChange={updateField('paymentType')}
                  disabled={selectedVisits.length === 0}
                >
                  <option value="cash">{t('config.form.paymentType.options.cash')}</option>
                  <option value="card">{t('config.form.paymentType.options.card')}</option>
                  <option value="bank_transfer">
                    {t('config.form.paymentType.options.bank_transfer')}
                  </option>
                  <option value="insurance">{t('config.form.paymentType.options.insurance')}</option>
                  <option value="other">{t('config.form.paymentType.options.other')}</option>
                </select>
              </div>
              <div className="space-y-1 text-xs">
                <label className="font-semibold">{t('config.sync.form.invoiceDate')}</label>
                <Input
                  type="date"
                  value={formState.invoiceDate}
                  onChange={updateField('invoiceDate')}
                  disabled={selectedVisits.length === 0}
                />
              </div>
              <div className="space-y-1 text-xs">
                <label className="font-semibold">{t('config.sync.form.notes')}</label>
                <textarea
                  className={textAreaClass}
                  value={formState.notes}
                  onChange={updateField('notes')}
                  placeholder="Add a quick note"
                  disabled={selectedVisits.length === 0}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
                disabled={selectedVisits.length === 0 || isSubmitting}
              >
                {t('config.sync.clearSelection')}
              </Button>
              <Button type="submit" size="sm" disabled={!canSubmit}>
                {isSubmitting ? <Loader2 className="mr-2 inline size-4 animate-spin" /> : null}
                {t('config.sync.createButton')}
              </Button>
            </div>
          </form>

          <p className="text-xs text-muted-foreground">{t('config.sync.manualDescription')}</p>
        </div>
      </CardContent>
    </Card>
  );
};

