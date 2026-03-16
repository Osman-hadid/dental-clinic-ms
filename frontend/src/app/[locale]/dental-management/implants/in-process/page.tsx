'use client';

import { JSX, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ListPatientsUseCase } from '@/modules/dental-management/application/use-cases/patients/list-patients-use-case';
import { ListVisitTreatmentsUseCase } from '@/modules/dental-management/application/use-cases/visit-treatments/list-visit-treatments-use-case';
import { ListVisitsUseCase } from '@/modules/dental-management/application/use-cases/visits/list-visits-use-case';
import { type Patient } from '@/modules/dental-management/domain/entities/Patient';
import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import { PatientRepository } from '@/modules/dental-management/infrastructure/repositories/patient-repository';
import { VisitTreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/visit-treatment-repository';
import { VisitRepository } from '@/modules/dental-management/infrastructure/repositories/visit-repository';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type SessionTaskStatus = 'pending' | 'in_progress' | 'done';
type SessionTaskMark = 'green' | 'blue' | 'yellow' | 'orange' | 'red' | 'purple';
type ImplantAvailabilityStatus = 'not_available' | 'in_purchase' | 'available' | 'done';
type SessionTask = {
  id: number;
  mark: SessionTaskMark;
  notes?: string;
  patientId: number;
  status: SessionTaskStatus;
  title: string;
};

const IMPLANT_TASK_MARKER = 'implant_tooth';
const AVAILABILITY_TO_TASK_STATUS: Record<ImplantAvailabilityStatus, SessionTaskStatus> = {
  available: 'in_progress',
  done: 'done',
  in_purchase: 'in_progress',
  not_available: 'pending',
};
const AVAILABILITY_TO_TASK_MARK: Record<ImplantAvailabilityStatus, SessionTaskMark> = {
  available: 'green',
  done: 'blue',
  in_purchase: 'yellow',
  not_available: 'red',
};
const AVAILABILITY_TITLES: Record<ImplantAvailabilityStatus, string> = {
  available: 'Available',
  done: 'Done',
  in_purchase: 'In Purchase',
  not_available: 'Not Available',
};
const AVAILABILITY_ORDER: ImplantAvailabilityStatus[] = ['not_available', 'in_purchase', 'available', 'done'];
const FALLBACK_TASK_STATUS_TO_AVAILABILITY: Record<SessionTaskStatus, ImplantAvailabilityStatus> = {
  done: 'done',
  in_progress: 'available',
  pending: 'not_available',
};

type ImplantCard = {
  availability: ImplantAvailabilityStatus;
  supplierPaid: number;
  supplierRemaining: number;
  supplierTotal: number;
  taskId: number;
  toothNumber: string;
};

type ImplantPlanningRecord = {
  arch: string;
  createdAt: string;
  dentistId?: string;
  diameterMm: string;
  id: number;
  implantSystem: string;
  lengthMm: string;
  loadingProtocol: string;
  notes: string;
  patientId: string;
  patientPrice: number;
  rawNotes: string;
  supplierCost: number;
  toothNumber: string;
  treatmentId: string;
  updatedAt: string;
  visitDate: string;
  visitId: string;
};

const extractImplantToothFromTask = (task: Pick<SessionTask, 'notes' | 'title'>): string | null => {
  const notesMatch = task.notes?.match(/\[implant_tooth:([0-9]{2})\]/i);
  if (notesMatch?.[1]) {
    return notesMatch[1];
  }

  const titleMatch = task.title.match(/([0-9]{2})/);
  return titleMatch?.[1] ?? null;
};

const parseAvailabilityFromTaskNotes = (notes?: string): ImplantAvailabilityStatus | null => {
  if (!notes) {
    return null;
  }

  const match = notes.match(/\[implant_availability:(not_available|in_purchase|available|done)\]/i);
  if (!match?.[1]) {
    return null;
  }

  const value = match[1].toLowerCase();
  if (value === 'not_available' || value === 'in_purchase' || value === 'available' || value === 'done') {
    return value;
  }

  return null;
};

const parseTaggedAmount = (notes: string | undefined, key: 'supplier_paid' | 'supplier_total'): number => {
  if (!notes) {
    return 0;
  }

  const match = notes.match(new RegExp(`\\[${key}:([0-9]+(?:\\.[0-9]+)?)\\]`, 'i'));
  if (!match?.[1]) {
    return 0;
  }

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const parseTaggedText = (notes: string | undefined, key: string): string => {
  if (!notes) {
    return '';
  }

  const match = notes.match(new RegExp(`\\[${key}:([^\\]]+)\\]`, 'i'));
  return match?.[1]?.trim() ?? '';
};

const parseTaggedNumber = (notes: string | undefined, key: string): number => {
  const text = parseTaggedText(notes, key);
  if (!text) {
    return 0;
  }

  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const stripTaggedTokens = (notes: string | undefined): string => {
  if (!notes) {
    return '';
  }

  return notes.replace(/\[[^\]]+\]/g, ' ').replace(/\s+/g, ' ').trim();
};

const formatDateTime = (value: string): string => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

const formatCurrency = (value: number): string => new Intl.NumberFormat('en-US', {
  currency: 'AFN',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  style: 'currency',
}).format(value);

const buildImplantTaskPayload = (
  toothNumber: string,
  availability: ImplantAvailabilityStatus,
  supplier: { paid: number; total: number }
): Pick<SessionTask, 'mark' | 'notes' | 'status' | 'title'> => ({
  mark: AVAILABILITY_TO_TASK_MARK[availability],
  notes: `[${IMPLANT_TASK_MARKER}:${toothNumber}] [implant_availability:${availability}] [supplier_paid:${supplier.paid.toFixed(2)}] [supplier_total:${supplier.total.toFixed(2)}]`,
  status: AVAILABILITY_TO_TASK_STATUS[availability],
  title: `Implant Tooth ${toothNumber}`,
});

// eslint-disable-next-line react/function-component-definition
export default function InProcessImplantsPage(): JSX.Element {
  const tSidebar = useTranslations('sidebar.dentalManagement');
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSearchDebounced, setPatientSearchDebounced] = useState('');
  const [availabilityToothSaving, setAvailabilityToothSaving] = useState<string | null>(null);
  const [supplierPayNowByTooth, setSupplierPayNowByTooth] = useState<Record<string, string>>({});
  const [selectedPlanningRecord, setSelectedPlanningRecord] = useState<ImplantPlanningRecord | null>(null);
  const patientTasksQueryKey = useMemo(() => ['patient-session-tasks', patientId], [patientId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPatientSearchDebounced(patientSearch.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [patientSearch]);

  const {
    data: patientPages,
    fetchNextPage,
    hasNextPage,
    isFetching: isLoadingPatients,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryFn: async ({ pageParam = 1 }) => {
      const patientRepository = new PatientRepository();
      const listPatientsUseCase = new ListPatientsUseCase(patientRepository);
      const response = await listPatientsUseCase.execute(
        patientSearchDebounced,
        ['patientCode', 'firstName', 'lastName', 'contactNumber'],
        [],
        {},
        pageParam,
        50
      );

      if (response.error || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch patients');
      }

      return response.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.meta.currentPage < lastPage.meta.lastPage ? lastPage.meta.currentPage + 1 : undefined,
    queryKey: ['in-process-implant-patient-options', patientSearchDebounced],
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    initialPageParam: 1,
  });

  const { data: patientSessionTasks = [] } = useQuery<SessionTask[]>({
    enabled: Boolean(patientId),
    queryFn: async () => {
      if (!patientId) {
        return [];
      }

      const client = new AxiosClient();
      const response = await client.get<SessionTask[]>(
        `/api/v1/dental-management/patients/${patientId}/session-tasks`
      );

      if (!response.success || !response.data) {
        return [];
      }

      return response.data;
    },
    queryKey: patientTasksQueryKey,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  });
  const {
    data: implantPlanningRecords = [],
    isFetching: isLoadingImplantPlanningRecords,
  } = useQuery<ImplantPlanningRecord[]>({
    enabled: Boolean(patientId),
    queryFn: async () => {
      if (!patientId) {
        return [];
      }

      const visitRepository = new VisitRepository();
      const listVisitsUseCase = new ListVisitsUseCase(visitRepository);
      const allVisits: Visit[] = [];
      let currentVisitPage = 1;
      let lastVisitPage = 1;

      do {
        const visitResponse = await listVisitsUseCase.execute(
          '',
          [],
          [],
          { patientId: [patientId] },
          currentVisitPage,
          100
        );
        if (visitResponse.error || !visitResponse.data) {
          return [];
        }

        allVisits.push(...visitResponse.data.data);
        lastVisitPage = visitResponse.data.meta?.lastPage ?? currentVisitPage;
        currentVisitPage += 1;
      } while (currentVisitPage <= lastVisitPage);

      if (allVisits.length === 0) {
        return [];
      }

      const visitIds = allVisits.map((visit) => String(visit.id));
      const visitDateById = allVisits.reduce<Record<string, string>>((accumulator, visit) => {
        accumulator[String(visit.id)] = visit.visitDate;
        return accumulator;
      }, {});

      const visitTreatmentRepository = new VisitTreatmentRepository();
      const listVisitTreatmentsUseCase = new ListVisitTreatmentsUseCase(visitTreatmentRepository);
      const allVisitTreatments: VisitTreatment[] = [];
      const chunkSize = 30;

      for (let index = 0; index < visitIds.length; index += chunkSize) {
        const visitIdChunk = visitIds.slice(index, index + chunkSize);
        let currentVisitTreatmentPage = 1;
        let lastVisitTreatmentPage = 1;

        do {
          const visitTreatmentResponse = await listVisitTreatmentsUseCase.execute(
            '',
            [],
            [],
            { visitId: visitIdChunk },
            currentVisitTreatmentPage,
            100
          );

          if (visitTreatmentResponse.error || !visitTreatmentResponse.data) {
            break;
          }

          allVisitTreatments.push(...visitTreatmentResponse.data.data);
          lastVisitTreatmentPage = visitTreatmentResponse.data.meta?.lastPage ?? currentVisitTreatmentPage;
          currentVisitTreatmentPage += 1;
        } while (currentVisitTreatmentPage <= lastVisitTreatmentPage);
      }

      return allVisitTreatments
        .filter((visitTreatment) => {
          const notes = visitTreatment.notes?.toLowerCase() ?? '';
          return notes.includes('[condition:implant]');
        })
        .map((visitTreatment) => {
          const rawNotes = visitTreatment.notes ?? '';
          const taggedTooth = parseTaggedText(rawNotes, 'tooth');
          const patientPriceFromNotes = parseTaggedNumber(rawNotes, 'patientPrice');
          const supplierCostFromNotes = parseTaggedNumber(rawNotes, 'supplierCost');
          const patientPriceFromRow = Number.parseFloat(visitTreatment.price);
          const patientPrice = Number.isFinite(patientPriceFromRow)
            ? patientPriceFromRow
            : patientPriceFromNotes;

          return {
            arch: parseTaggedText(rawNotes, 'arch') || '-',
            createdAt: visitTreatment.createdAt,
            dentistId: visitTreatment.dentistId,
            diameterMm: parseTaggedText(rawNotes, 'diameter') || '-',
            id: visitTreatment.id,
            implantSystem: visitTreatment.material?.trim() || '-',
            lengthMm: parseTaggedText(rawNotes, 'length') || '-',
            loadingProtocol: parseTaggedText(rawNotes, 'protocol') || '-',
            notes: stripTaggedTokens(rawNotes) || '-',
            patientId,
            patientPrice: Math.max(0, patientPrice),
            rawNotes: rawNotes || '-',
            supplierCost: supplierCostFromNotes,
            toothNumber: visitTreatment.toothNumber || taggedTooth || '-',
            treatmentId: visitTreatment.treatmentId,
            updatedAt: visitTreatment.updatedAt,
            visitDate: visitDateById[visitTreatment.visitId] || '-',
            visitId: visitTreatment.visitId,
          } satisfies ImplantPlanningRecord;
        })
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    queryKey: ['in-process-implant-planning-records', patientId],
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  });

  const allPatients = useMemo(
    () => (patientPages?.pages ?? []).flatMap((page) => page.data),
    [patientPages]
  );

  const patientOptions = useMemo(() => {
    const uniquePatients = new Map<string, Patient>();
    allPatients.forEach((patient) => {
      uniquePatients.set(String(patient.id), patient);
    });

    return Array.from(uniquePatients.values())
      .map((patient) => ({
        id: String(patient.id),
        label: `${patient.firstName} ${patient.lastName} (${patient.patientCode})`.trim(),
      }))
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
  }, [allPatients]);

  const implantCards = useMemo<ImplantCard[]>(() => {
    const cards = patientSessionTasks
      .map((task) => {
        const notes = task.notes ?? '';
        if (!notes.includes(IMPLANT_TASK_MARKER) && !task.title.toLowerCase().includes('implant tooth')) {
          return null;
        }

        const toothNumber = extractImplantToothFromTask(task);
        if (!toothNumber) {
          return null;
        }

        const availabilityFromNotes = parseAvailabilityFromTaskNotes(task.notes);
        const supplierTotal = parseTaggedAmount(task.notes, 'supplier_total');
        const supplierPaidRaw = parseTaggedAmount(task.notes, 'supplier_paid');
        const supplierPaid = Math.min(supplierTotal, supplierPaidRaw);
        const supplierRemaining = Math.max(0, supplierTotal - supplierPaid);

        return {
          availability: availabilityFromNotes ?? FALLBACK_TASK_STATUS_TO_AVAILABILITY[task.status],
          supplierPaid,
          supplierRemaining,
          supplierTotal,
          taskId: task.id,
          toothNumber,
        };
      })
      .filter((card): card is ImplantCard => Boolean(card));

    const uniqueByTaskTooth = new Map<string, ImplantCard>();
    cards.forEach((card) => {
      const key = `${card.taskId}-${card.toothNumber}`;
      uniqueByTaskTooth.set(key, card);
    });

    return Array.from(uniqueByTaskTooth.values()).sort((left, right) =>
      left.toothNumber.localeCompare(right.toothNumber, undefined, { numeric: true })
    );
  }, [patientSessionTasks]);

  const implantCardByTooth = useMemo<Record<string, ImplantCard>>(() => {
    const result: Record<string, ImplantCard> = {};
    implantCards.forEach((card) => {
      result[card.toothNumber] = card;
    });
    return result;
  }, [implantCards]);

  const groupedImplants = useMemo(() => {
    const grouped: Record<ImplantAvailabilityStatus, ImplantCard[]> = {
      available: [],
      done: [],
      in_purchase: [],
      not_available: [],
    };

    implantCards.forEach((card) => {
      grouped[card.availability].push(card);
    });

    return grouped;
  }, [implantCards]);
  const unpaidSupplierRows = useMemo(() => {
    return implantCards
      .filter((card) => card.supplierRemaining > 0)
      .sort((left, right) => left.toothNumber.localeCompare(right.toothNumber, undefined, { numeric: true }));
  }, [implantCards]);

  const fetchCsrfClient = async (): Promise<AxiosClient> => {
    const client = new AxiosClient();
    await client.get('/sanctum/csrf-cookie');
    return client;
  };

  const setImplantAvailabilityMutation = useMutation({
    mutationFn: async ({
      nextAvailability,
      supplierPaid,
      supplierTotal,
      taskId,
      toothNumber,
    }: {
      nextAvailability: ImplantAvailabilityStatus;
      supplierPaid: number;
      supplierTotal: number;
      taskId: number;
      toothNumber: string;
    }) => {
      if (!patientId) {
        throw new Error('Patient is required.');
      }

      const client = await fetchCsrfClient();
      return client.put<SessionTask>(
        `/api/v1/dental-management/patients/${patientId}/session-tasks/${taskId}`,
        buildImplantTaskPayload(toothNumber, nextAvailability, {
          paid: supplierPaid,
          total: supplierTotal,
        })
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: patientTasksQueryKey });
    },
  });

  const handleSetImplantAvailability = async (
    taskId: number,
    toothNumber: string,
    nextAvailability: ImplantAvailabilityStatus
  ): Promise<void> => {
    if (!patientId) {
      toast.error('Select a patient first.');
      return;
    }

    const card = implantCardByTooth[toothNumber];
    if (!card) {
      toast.error('Implant card not found.');
      return;
    }

    let supplierPaidNext = card.supplierPaid;
    const supplierRemainingBefore = Math.max(0, card.supplierTotal - card.supplierPaid);
    const requestedPayNow = Number.parseFloat(supplierPayNowByTooth[toothNumber] ?? '');
    const supplierPayNow = Number.isFinite(requestedPayNow)
      ? Math.min(Math.max(0, requestedPayNow), supplierRemainingBefore)
      : 0;

    if (card.availability === nextAvailability && supplierPayNow <= 0) {
      return;
    }

    setAvailabilityToothSaving(toothNumber);
    try {
      if (supplierPayNow > 0) {
        const safeClient = await fetchCsrfClient();
        const today = new Date().toISOString().slice(0, 10);
        const safeResponse = await safeClient.post<{ id: number }>(
          '/api/v1/dental-management/safe-transactions',
          {
            amount: supplierPayNow,
            currency: 'AFN',
            direction: 'out',
            entryType: 'expense',
            exchangeRate: 1,
            notes: `Implant supplier payment for tooth ${toothNumber}.`,
            sourceId: taskId,
            sourceType: 'implant_supplier',
            transactionDate: today,
          }
        );

        if (!safeResponse.success) {
          toast.error(safeResponse.error?.message || 'Could not record supplier payment in safe.');
          return;
        }

        supplierPaidNext = Math.min(card.supplierTotal, card.supplierPaid + supplierPayNow);
      }

      const response = await setImplantAvailabilityMutation.mutateAsync({
        nextAvailability,
        supplierPaid: supplierPaidNext,
        supplierTotal: card.supplierTotal,
        taskId,
        toothNumber,
      });

      if (!response.success) {
        toast.error(response.error?.message || 'Failed to update implant status.');
        return;
      }

      setSupplierPayNowByTooth((prev) => ({ ...prev, [toothNumber]: '' }));
      toast.success(`Tooth ${toothNumber} moved to ${AVAILABILITY_TITLES[nextAvailability]}.`);
    } catch {
      toast.error('Failed to update implant status.');
    } finally {
      setAvailabilityToothSaving(null);
    }
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'implants', label: tSidebar('implants') },
          { id: 'implantsInProcess', isCurrent: true, label: tSidebar('implantsInProcess') },
        ]}
      />

      <div className="flex flex-1 flex-col px-4 pb-6 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>In-Process Implants</CardTitle>
            <CardDescription>
              Manage implant tooth lifecycle cards: not-available, in purchase, available, and done.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="max-w-md space-y-2">
              <Input
                placeholder="Search patient (name, code, phone)"
                value={patientSearch}
                onChange={(event) => setPatientSearch(event.target.value)}
              />
              <Select
                value={patientId || undefined}
                onValueChange={setPatientId}
                disabled={isLoadingPatients || patientOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingPatients ? 'Loading patients...' : 'Select patient'} />
                </SelectTrigger>
                <SelectContent
                  onScroll={(event) => {
                    const target = event.currentTarget;
                    const isNearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 20;
                    if (isNearBottom && hasNextPage && !isFetchingNextPage) {
                      void fetchNextPage();
                    }
                  }}
                >
                  {patientOptions.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.label}
                    </SelectItem>
                  ))}
                  {hasNextPage ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground space-y-2">
                      <p>{isFetchingNextPage ? 'Loading more patients...' : 'Scroll to load more patients.'}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isFetchingNextPage}
                        onClick={() => {
                          void fetchNextPage();
                        }}
                      >
                        {isFetchingNextPage ? (
                          <Loader2 className="me-2 size-4 animate-spin" />
                        ) : null}
                        Load more
                      </Button>
                    </div>
                  ) : null}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Type to search by name, code, or phone. Scroll to load more.
              </p>
            </div>

            {!patientId ? (
              <p className="text-sm text-muted-foreground">Select a patient to see implant lifecycle cards.</p>
            ) : (
              <div className="space-y-4">
                <Card id="saved-implant-records">
                  <CardHeader>
                    <CardTitle className="text-base">Saved Implant Records</CardTitle>
                    <CardDescription>
                      Implant records created from the Implant Planning page. Click a card to view full data.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingImplantPlanningRecords ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Loading implant records...
                      </div>
                    ) : implantPlanningRecords.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No saved implant planning records found.</p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {implantPlanningRecords.map((record) => (
                          <button
                            key={`planning-record-${record.id}`}
                            type="button"
                            className="rounded-md border border-border p-3 text-start transition-colors hover:bg-muted/40"
                            onClick={() => {
                              setSelectedPlanningRecord(record);
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold">Tooth {record.toothNumber}</p>
                              <Badge variant="outline">Visit {record.visitId}</Badge>
                            </div>
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              <p>Patient price: <span className="font-medium text-foreground">{formatCurrency(record.patientPrice)}</span></p>
                              <p>Supplier cost: <span className="font-medium text-foreground">{formatCurrency(record.supplierCost)}</span></p>
                              <p>Implant system: <span className="font-medium text-foreground">{record.implantSystem}</span></p>
                              <p>Saved at: <span className="font-medium text-foreground">{formatDateTime(record.createdAt)}</span></p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {AVAILABILITY_ORDER.map((availability) => (
                    <div key={availability} className="space-y-2 rounded-md border border-border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{AVAILABILITY_TITLES[availability]}</p>
                        <Badge variant={availability === 'done' || availability === 'available' ? 'default' : availability === 'in_purchase' ? 'secondary' : 'destructive'}>
                          {groupedImplants[availability].length}
                        </Badge>
                      </div>

                      {groupedImplants[availability].length === 0 ? (
                        <p className="text-xs text-muted-foreground">No implant cards in this state.</p>
                      ) : (
                        <div className="space-y-2">
                          {groupedImplants[availability].map((card) => (
                            <div key={`${card.taskId}-${card.toothNumber}`} className="rounded-md border border-border p-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Tooth {card.toothNumber}</span>
                                <Badge variant="outline">{AVAILABILITY_TITLES[card.availability]}</Badge>
                              </div>
                              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                <p>Total company cost: <span className="font-medium text-foreground">{formatCurrency(card.supplierTotal)}</span></p>
                                <p>Paid to company: <span className="font-medium text-foreground">{formatCurrency(card.supplierPaid)}</span></p>
                                <p>Unpaid company amount: <span className="font-medium text-foreground">{formatCurrency(card.supplierRemaining)}</span></p>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="Company pay now"
                                  value={supplierPayNowByTooth[card.toothNumber] ?? ''}
                                  onChange={(event) => {
                                    setSupplierPayNowByTooth((prev) => ({
                                      ...prev,
                                      [card.toothNumber]: event.target.value,
                                    }));
                                  }}
                                />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {AVAILABILITY_ORDER.map((targetAvailability) => (
                                  <Button
                                    key={targetAvailability}
                                    type="button"
                                    size="sm"
                                    variant={card.availability === targetAvailability ? 'default' : 'outline'}
                                    disabled={availabilityToothSaving === card.toothNumber}
                                    onClick={() => {
                                      void handleSetImplantAvailability(card.taskId, card.toothNumber, targetAvailability);
                                    }}
                                  >
                                    {availabilityToothSaving === card.toothNumber && card.availability !== targetAvailability ? (
                                      <Loader2 className="me-2 size-4 animate-spin" />
                                    ) : null}
                                    {AVAILABILITY_TITLES[targetAvailability]}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {patientId ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Unpaid Third-Company Payments</CardTitle>
                  <CardDescription>
                    Outstanding clinic payments to implant supplier by tooth.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {unpaidSupplierRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No unpaid supplier balances.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tooth</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Paid</TableHead>
                          <TableHead>Unpaid</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unpaidSupplierRows.map((row) => (
                          <TableRow key={`unpaid-${row.taskId}-${row.toothNumber}`}>
                            <TableCell>Tooth {row.toothNumber}</TableCell>
                            <TableCell>{AVAILABILITY_TITLES[row.availability]}</TableCell>
                            <TableCell>{formatCurrency(row.supplierTotal)}</TableCell>
                            <TableCell>{formatCurrency(row.supplierPaid)}</TableCell>
                            <TableCell>{formatCurrency(row.supplierRemaining)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(selectedPlanningRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPlanningRecord(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Implant Record {selectedPlanningRecord ? `#${selectedPlanningRecord.id}` : ''}
            </DialogTitle>
            <DialogDescription>
              Full record data saved from the Implant Planning page.
            </DialogDescription>
          </DialogHeader>

          {selectedPlanningRecord ? (
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p><span className="text-muted-foreground">Patient ID:</span> {selectedPlanningRecord.patientId}</p>
              <p><span className="text-muted-foreground">Visit ID:</span> {selectedPlanningRecord.visitId}</p>
              <p><span className="text-muted-foreground">Visit date:</span> {selectedPlanningRecord.visitDate}</p>
              <p><span className="text-muted-foreground">Treatment ID:</span> {selectedPlanningRecord.treatmentId}</p>
              <p><span className="text-muted-foreground">Dentist ID:</span> {selectedPlanningRecord.dentistId || '-'}</p>
              <p><span className="text-muted-foreground">Tooth:</span> {selectedPlanningRecord.toothNumber}</p>
              <p><span className="text-muted-foreground">Patient price:</span> {formatCurrency(selectedPlanningRecord.patientPrice)}</p>
              <p><span className="text-muted-foreground">Supplier cost:</span> {formatCurrency(selectedPlanningRecord.supplierCost)}</p>
              <p><span className="text-muted-foreground">Implant system:</span> {selectedPlanningRecord.implantSystem}</p>
              <p><span className="text-muted-foreground">Diameter (mm):</span> {selectedPlanningRecord.diameterMm}</p>
              <p><span className="text-muted-foreground">Length (mm):</span> {selectedPlanningRecord.lengthMm}</p>
              <p><span className="text-muted-foreground">Arch:</span> {selectedPlanningRecord.arch}</p>
              <p><span className="text-muted-foreground">Loading protocol:</span> {selectedPlanningRecord.loadingProtocol}</p>
              <p><span className="text-muted-foreground">Created:</span> {formatDateTime(selectedPlanningRecord.createdAt)}</p>
              <p><span className="text-muted-foreground">Updated:</span> {formatDateTime(selectedPlanningRecord.updatedAt)}</p>
              <div className="space-y-1 md:col-span-2">
                <p className="text-muted-foreground">Notes:</p>
                <p className="rounded-md border border-border bg-muted/20 p-2">{selectedPlanningRecord.notes}</p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <p className="text-muted-foreground">Raw record:</p>
                <p className="rounded-md border border-border bg-muted/20 p-2 text-xs">{selectedPlanningRecord.rawNotes}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
