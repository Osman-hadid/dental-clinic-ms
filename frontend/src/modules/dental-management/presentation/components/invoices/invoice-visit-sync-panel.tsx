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
  DEFAULT_AFN_PER_USD,
  convertUsdToInput,
  getExchangeRate,
} from '@/lib/currency-utils';
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
  currency: 'AFN' | 'USD';
  discount: string;
  exchangeRate: string;
  invoiceDate: string;
  notes: string;
  paymentType: string;
  status: string;
};

type VisitAmountSummary = {
  currency: 'AFN' | 'USD';
  exchangeRate: number;
  inputTotal: number;
  isConsistent: boolean;
  usdTotal: number;
};

const createDefaultFormState = (invoiceDate: string, afnPerUsd: number): VisitInvoiceFormState => ({
  currency: 'USD',
  discount: '0',
  exchangeRate: String(afnPerUsd),
  invoiceDate,
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

const parseCurrencyTagFromNotes = (notes: unknown): 'AFN' | 'USD' | null => {
  const text = asText(notes);
  if (!text) {
    return null;
  }

  const match = text.match(/\[currency:(AFN|USD)\]/i);
  if (!match) {
    return null;
  }

  const value = match[1].toUpperCase();
  return value === 'AFN' ? 'AFN' : 'USD';
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
const exchangeRateClient = new AxiosClient();

export const InvoiceVisitSyncPanel = (): JSX.Element => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParameters = useSearchParams();
  const requestedVisitId = asText(searchParameters.get('visitId'));
  const flowSource = asText(searchParameters.get('flow')).toLowerCase();
  const isChartFlow = flowSource === 'chart';
  const hasProcessedRequestedVisit = useRef(false);
  const [afnPerUsd, setAfnPerUsd] = useState(DEFAULT_AFN_PER_USD);
  const [formState, setFormState] = useState<VisitInvoiceFormState>(() =>
    createDefaultFormState(new Date().toISOString().slice(0, 10), DEFAULT_AFN_PER_USD)
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
    type VisitAccumulator = {
      currency: 'AFN' | 'USD' | null;
      exchangeRate: number | null;
      inputTotal: number;
      isConsistent: boolean;
      usdTotal: number;
    };

    const totals = new Map<string, VisitAccumulator>();
    for (const visitId of visitPreviewIds) {
      totals.set(visitId, {
        currency: null,
        exchangeRate: null,
        inputTotal: 0,
        isConsistent: true,
        usdTotal: 0,
      });
    }

    for (const treatment of visitTreatments) {
      const visitId = asText(treatment.visitId);
      const visitTotals = totals.get(visitId);
      if (!visitTotals) {
        continue;
      }

      const currencyFromNotes = parseCurrencyTagFromNotes(treatment.notes) ?? 'USD';
      const exchangeRateFromNotes = parseNumericTagFromNotes(treatment.notes, 'exchangeRate');
      const normalizedRate =
        currencyFromNotes === 'AFN'
          ? Math.max(0.000001, exchangeRateFromNotes || afnPerUsd)
          : 1;

      const treatmentChargeUsd = parseCurrency(treatment.price);
      const treatmentChargeInputFromNotes = parseNumericTagFromNotes(treatment.notes, 'priceInput');
      const treatmentChargeInput = treatmentChargeInputFromNotes > 0
        ? treatmentChargeInputFromNotes
        : (
          currencyFromNotes === 'AFN'
            ? roundCurrency(treatmentChargeUsd * normalizedRate)
            : treatmentChargeUsd
        );

      const imageChargeUsd = parseImagePriceFromNotes(treatment.notes);
      const imageChargeInputFromNotes = parseNumericTagFromNotes(treatment.notes, 'imagePriceInput');
      const imageChargeInput = imageChargeInputFromNotes > 0
        ? imageChargeInputFromNotes
        : (
          currencyFromNotes === 'AFN'
            ? roundCurrency(imageChargeUsd * normalizedRate)
            : imageChargeUsd
        );

      visitTotals.usdTotal = roundCurrency(visitTotals.usdTotal + treatmentChargeUsd + imageChargeUsd);
      visitTotals.inputTotal = roundCurrency(visitTotals.inputTotal + treatmentChargeInput + imageChargeInput);

      if (visitTotals.currency === null) {
        visitTotals.currency = currencyFromNotes;
        visitTotals.exchangeRate = normalizedRate;
      } else {
        const hasDifferentCurrency = visitTotals.currency !== currencyFromNotes;
        const hasDifferentRate =
          currencyFromNotes === 'AFN'
          && visitTotals.currency === 'AFN'
          && Math.abs((visitTotals.exchangeRate ?? normalizedRate) - normalizedRate) > 0.0001;

        if (hasDifferentCurrency || hasDifferentRate) {
          visitTotals.isConsistent = false;
        }
      }
    }

    const summaryMap = new Map<string, VisitAmountSummary>();
    for (const [visitId, entry] of totals.entries()) {
      const hasConsistentCurrency = entry.isConsistent && !!entry.currency;
      const currency = hasConsistentCurrency ? (entry.currency as 'AFN' | 'USD') : 'USD';
      const exchangeRate =
        hasConsistentCurrency && currency === 'AFN'
          ? Math.max(0.000001, entry.exchangeRate ?? afnPerUsd)
          : 1;
      const inputTotal = hasConsistentCurrency
        ? roundCurrency(entry.inputTotal)
        : roundCurrency(entry.usdTotal);

      summaryMap.set(visitId, {
        currency,
        exchangeRate,
        inputTotal,
        isConsistent: hasConsistentCurrency,
        usdTotal: roundCurrency(entry.usdTotal),
      });
    }

    return summaryMap;
  }, [afnPerUsd, visitPreviewIds, visitTreatments]);

  const selectedVisitAmountSummary = useMemo(() => {
    if (selectedVisits.length === 0) {
      return null;
    }

    return visitAmountsById.get(String(selectedVisits[0].id)) ?? null;
  }, [selectedVisits, visitAmountsById]);

  const combinedTotalUsd = useMemo(() => {
    return selectedVisits.reduce((sum, visit) => {
      const amount = visitAmountsById.get(String(visit.id))?.usdTotal ?? 0;
      return roundCurrency(sum + amount);
    }, 0);
  }, [selectedVisits, visitAmountsById]);

  const selectedExchangeRate = Math.max(0.000001, parseCurrency(formState.exchangeRate) || afnPerUsd);
  const effectiveCurrency = selectedVisitAmountSummary?.currency ?? formState.currency;
  const effectiveExchangeRate =
    selectedVisitAmountSummary?.currency === 'AFN'
      ? Math.max(0.000001, selectedVisitAmountSummary.exchangeRate)
      : selectedExchangeRate;
  const combinedTotal = useMemo(
    () => (
      selectedVisitAmountSummary
        ? selectedVisitAmountSummary.inputTotal
        : convertUsdToInput(combinedTotalUsd, formState.currency, selectedExchangeRate)
    ),
    [combinedTotalUsd, formState.currency, selectedExchangeRate, selectedVisitAmountSummary]
  );
  const selectedCount = selectedVisits.length;
  const appliedDiscount = Math.max(0, roundCurrency(parseCurrency(formState.discount)));
  const combinedNet = Math.max(0, roundCurrency(combinedTotal - appliedDiscount));

  const resetForm = (): void => {
    setFormState(createDefaultFormState(new Date().toISOString().slice(0, 10), afnPerUsd));
  };

  const toggleVisitSelection = (visitId: number): void => {
    if (!selectableVisitSet.has(String(visitId))) {
      return;
    }

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
    void getExchangeRate(exchangeRateClient).then((rate: number) => {
      setAfnPerUsd(rate);
      setFormState((previous) => ({ ...previous, exchangeRate: String(rate) }));
    });
  }, []);

  useEffect(() => {
    if (!selectedVisitAmountSummary) {
      return;
    }

    setFormState((previous) => {
      const nextCurrency = selectedVisitAmountSummary.currency;
      const nextRate = selectedVisitAmountSummary.currency === 'AFN'
        ? String(selectedVisitAmountSummary.exchangeRate)
        : '1';

      if (previous.currency === nextCurrency && previous.exchangeRate === nextRate) {
        return previous;
      }

      return {
        ...previous,
        currency: nextCurrency,
        exchangeRate: nextRate,
      };
    });
  }, [selectedVisitAmountSummary]);

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
    if (effectiveExchangeRate <= 0) {
      toast.error('Please provide a valid exchange rate.');
      return;
    }

    const linkedVisitLabels = selectedVisits.map((visit) => formatVisitLabel(visit)).join(', ');
    const linkedVisitSegment = `${t('config.sync.linkedVisitsNote')}: ${linkedVisitLabels}`;
    const mergedNotes = [formState.notes.trim(), linkedVisitSegment].filter(Boolean).join(' | ');

    setIsSubmitting(true);

    try {
      const patientIdNumber = Number(firstSelectedVisit.patientId);
      const payload = {
        currency: effectiveCurrency,
        discount: appliedDiscount,
        exchangeRate: effectiveExchangeRate,
        invoiceDate: formState.invoiceDate || new Date().toISOString().slice(0, 10),
        netAmount: combinedNet,
        notes: mergedNotes.slice(0, 255) || undefined,
        patientId: Number.isNaN(patientIdNumber)
          ? firstSelectedVisit.patientId
          : patientIdNumber,
        paymentType: formState.paymentType,
        sourceVisitIds: [Number(firstSelectedVisit.id)],
        status: formState.status,
        totalAmount: combinedTotal,
        visitId: Number(firstSelectedVisit.id),
      };

      const response = await createInvoice.mutateAsync(payload);
      if (response.success) {
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
                    const visitCurrency = visitAmountSummary?.currency ?? 'USD';

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
                          {isLoadingVisitAmounts ? '-' : `${formatMoney(visitAmount)} ${visitCurrency}`}
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
          <div className="grid gap-2 md:grid-cols-3">
            <p className="text-sm font-semibold">
              {t('config.sync.selectedCount')}: <span>{selectedCount}</span>
            </p>
            <p className="text-sm font-semibold">
              {t('config.sync.combinedAmount')}: <span>{formatMoney(combinedTotal)} {effectiveCurrency}</span>
            </p>
            <p className="text-sm font-semibold">
              {t('config.sync.form.netAmount')}: <span>{formatMoney(combinedNet)} {effectiveCurrency}</span>
            </p>
          </div>

          {selectedVisits.length > 0 ? (
            <div className="space-y-2 text-xs text-muted-foreground">
              {selectedVisits.map((visit) => (
                <p key={`selected-visit-${visit.id}`}>
                  {formatVisitLabel(visit)} ({formatDate(visit.visitDate)}) - {formatMoney(
                    visitAmountsById.get(String(visit.id))?.inputTotal ?? 0
                  )} {visitAmountsById.get(String(visit.id))?.currency ?? 'USD'}
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
                <Input type="number" value={formatMoney(combinedNet)} readOnly />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-1 text-xs">
                <label className="font-semibold">Currency</label>
                <select
                  className={inputClass}
                  value={formState.currency}
                  onChange={updateField('currency')}
                  disabled={selectedVisits.length === 0 || selectedVisitAmountSummary !== null}
                >
                  <option value="USD">USD ($)</option>
                  <option value="AFN">AFN (Afghani)</option>
                </select>
              </div>
              <div className="space-y-1 text-xs">
                <label className="font-semibold">Exchange Rate (AFN per 1 USD)</label>
                <Input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={formState.exchangeRate}
                  onChange={updateField('exchangeRate')}
                  disabled={selectedVisits.length === 0 || selectedVisitAmountSummary !== null}
                />
              </div>
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

