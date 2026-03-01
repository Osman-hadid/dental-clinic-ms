'use client';

import { JSX, useMemo, useState } from 'react';
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
import { type Patient } from '@/modules/dental-management/domain/entities/Patient';
import { PatientRepository } from '@/modules/dental-management/infrastructure/repositories/patient-repository';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  const [availabilityToothSaving, setAvailabilityToothSaving] = useState<string | null>(null);
  const [supplierPayNowByTooth, setSupplierPayNowByTooth] = useState<Record<string, string>>({});
  const patientTasksQueryKey = useMemo(() => ['patient-session-tasks', patientId], [patientId]);

  const { data: allPatients = [], isFetching: isLoadingPatients } = useQuery<Patient[]>({
    queryFn: async () => {
      const patientRepository = new PatientRepository();
      const listPatientsUseCase = new ListPatientsUseCase(patientRepository);
      const all: Patient[] = [];
      let currentPage = 1;
      let lastPage = 1;

      do {
        const response = await listPatientsUseCase.execute('', [], [], {}, currentPage, 100);
        if (response.error || !response.data) {
          throw new Error(response.error?.message || 'Failed to fetch patients');
        }

        all.push(...response.data.data);
        lastPage = response.data.meta?.lastPage ?? currentPage;
        currentPage += 1;
      } while (currentPage <= lastPage);

      return all;
    },
    queryKey: ['in-process-implant-patient-options'],
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
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

  const patientOptions = useMemo(
    () => allPatients
      .map((patient) => ({
        id: String(patient.id),
        label: `${patient.firstName} ${patient.lastName} (${patient.patientCode})`.trim(),
      }))
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })),
    [allPatients]
  );

  const implantCards = useMemo<ImplantCard[]>(() => {
    return patientSessionTasks
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
      .filter((card): card is ImplantCard => Boolean(card))
      .sort((left, right) => left.toothNumber.localeCompare(right.toothNumber, undefined, { numeric: true }));
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
            <div className="max-w-md">
              <Select
                value={patientId || undefined}
                onValueChange={setPatientId}
                disabled={isLoadingPatients || patientOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingPatients ? 'Loading patients...' : 'Select patient'} />
                </SelectTrigger>
                <SelectContent>
                  {patientOptions.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!patientId ? (
              <p className="text-sm text-muted-foreground">Select a patient to see implant lifecycle cards.</p>
            ) : (
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
                          <div key={card.taskId} className="rounded-md border border-border p-2">
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
                          <TableRow key={`unpaid-${row.taskId}`}>
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
    </>
  );
}
