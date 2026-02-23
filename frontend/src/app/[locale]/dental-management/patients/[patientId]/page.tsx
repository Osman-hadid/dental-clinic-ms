'use client';

import { JSX, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type Tooth } from '@/modules/dental-management/domain/entities/Tooth';
import { type Treatment } from '@/modules/dental-management/domain/entities/Treatment';
import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import {
  useGetPatient,
  useToothList,
  useVisitList,
  useVisitTreatmentList,
} from '@/modules/dental-management/presentation/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  HeartPulse,
  Sparkles,
  Stethoscope,
  Trash2,
  UserRound,
} from 'lucide-react';

type ConditionKey =
  | 'caries'
  | 'surgery'
  | 'implant'
  | 'gingivitis'
  | 'periodontitis'
  | 'removal'
  | 'periostitis';

type ConditionMeta = {
  color: string;
  label: string;
};

type VisitTreatmentWithRelations = VisitTreatment & {
  tooth?: Partial<Tooth>;
  treatment?: Partial<Treatment>;
  visit?: { visitDate?: string };
};

type SessionTaskStatus = 'done' | 'in_progress' | 'pending';

type SessionTask = {
  id: number;
  title: string;
  mark: string;
  status: SessionTaskStatus;
  notes?: string;
  createdAt: string;
};

const CONDITIONS: Record<ConditionKey, ConditionMeta> = {
  caries: { color: '#56d0ff', label: 'Caries' },
  gingivitis: { color: '#ff6ca8', label: 'Gingivitis' },
  implant: { color: '#7e7bff', label: 'Implant' },
  periodontitis: { color: '#62dfb9', label: 'Periodontitis' },
  periostitis: { color: '#f59e0b', label: 'Periostitis' },
  removal: { color: '#9ca3af', label: 'Removal' },
  surgery: { color: '#ba68ff', label: 'Surgery' },
};

const CONDITION_CODES: Record<string, ConditionKey> = {
  c: 'caries',
  g: 'gingivitis',
  i: 'implant',
  o: 'periostitis',
  p: 'periodontitis',
  r: 'removal',
  s: 'surgery',
};

const UPPER_ARCH = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26'];
const LOWER_ARCH = ['44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38', '47', '48'];
const RING_TEETH = [...UPPER_ARCH, ...LOWER_ARCH];
const MAX_PER_PAGE = 100;
const TASK_MARKS = [
  { color: '#22c55e', label: 'Routine', value: 'green' },
  { color: '#3b82f6', label: 'Info', value: 'blue' },
  { color: '#eab308', label: 'Watch', value: 'yellow' },
  { color: '#f97316', label: 'Priority', value: 'orange' },
  { color: '#ef4444', label: 'Urgent', value: 'red' },
  { color: '#a855f7', label: 'Special', value: 'purple' },
] as const;

const parseConditionToken = (value?: string): ConditionKey | null => {
  if (!value) return null;
  const token = value.trim().toLowerCase();
  if (token in CONDITIONS) return token as ConditionKey;
  return CONDITION_CODES[token] ?? null;
};

const parseChartConditionMap = (notes?: string): Record<string, ConditionKey> => {
  if (!notes) return {};

  const match = notes.match(/\[chart:([^\]]+)\]/i);
  if (!match) return {};

  const result: Record<string, ConditionKey> = {};
  const pairs = match[1].split(',');
  for (const pair of pairs) {
    const [tooth, conditionRaw] = pair.split('=').map((item) => item?.trim() ?? '');
    const condition = parseConditionToken(conditionRaw);
    if (/^\d{2}$/.test(tooth) && condition) {
      result[tooth] = condition;
    }
  }

  return result;
};

const parseLegacyCondition = (notes?: string): ConditionKey | null => {
  if (!notes) return null;
  const match = notes.match(/\[condition:([a-z]+)\]/i);
  return parseConditionToken(match?.[1]);
};

const parseLegacyTooth = (notes?: string): string | null => {
  if (!notes) return null;
  const match = notes.match(/\[tooth:([0-9]{2})\]/i);
  return match?.[1] ?? null;
};

const ageFromDate = (dateOfBirth?: string): number | null => {
  if (!dateOfBirth) return null;

  const birthday = new Date(dateOfBirth);
  if (Number.isNaN(birthday.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDiff = today.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
    age -= 1;
  }
  return age;
};

// eslint-disable-next-line react/function-component-definition
export default function PatientProfilePage(): JSX.Element {
  const params = useParams<{ patientId: string }>();
  const patientId = Array.isArray(params?.patientId) ? params.patientId[0] : params?.patientId;
  const tSidebar = useTranslations('sidebar.dentalManagement');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [taskTitle, setTaskTitle] = useState('');
  const [taskMark, setTaskMark] = useState<string>('blue');
  const [taskStatus, setTaskStatus] = useState<SessionTaskStatus>('pending');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskError, setTaskError] = useState('');

  const { data: patientResponse, isFetching: isLoadingPatient } = useGetPatient(patientId || '', {
    enabled: !!patientId,
  });
  const patient = patientResponse?.data ?? null;

  const { entities: teeth } = useToothList(1, MAX_PER_PAGE);
  const toothById = useMemo(
    () => new Map(teeth.map((tooth) => [String(tooth.id), tooth.toothNumber])),
    [teeth]
  );

  const visitFilters = useMemo(() => ({ patientId: patientId ? [patientId] : ['-1'] }), [patientId]);
  const { entities: visits } = useVisitList(
    1,
    MAX_PER_PAGE,
    '',
    [],
    ['appointment', 'dentist'],
    visitFilters
  );
  const visitIds = useMemo(() => visits.map((visit) => String(visit.id)), [visits]);

  const visitTreatmentFilters = useMemo(
    () => ({ visitId: visitIds.length > 0 ? visitIds : ['-1'] }),
    [visitIds]
  );
  const { entities: visitTreatments, isFetching: isLoadingTreatments } = useVisitTreatmentList(
    1,
    MAX_PER_PAGE,
    '',
    [],
    ['tooth', 'treatment', 'visit'],
    visitTreatmentFilters
  );
  const typedVisitTreatments = visitTreatments as VisitTreatmentWithRelations[];

  const tasksQueryKey = useMemo(() => ['patient-session-tasks', patientId], [patientId]);
  const { data: manualTasks = [], isFetching: isLoadingManualTasks } = useQuery<SessionTask[]>({
    enabled: !!patientId,
    queryFn: async () => {
      const client = new AxiosClient();
      const response = await client.get<SessionTask[] | { data?: SessionTask[] }>(
        `/api/v1/dental-management/patients/${patientId}/session-tasks`
      );

      if (!response.success || !response.data) {
        return [];
      }

      if (Array.isArray(response.data)) {
        return response.data;
      }

      return Array.isArray(response.data.data) ? response.data.data : [];
    },
    queryKey: tasksQueryKey,
    staleTime: 0,
  });

  const fullName = useMemo(() => {
    if (!patient) return 'Unknown patient';
    return [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || patient.patientCode;
  }, [patient]);

  const patientAge = useMemo(() => ageFromDate(patient?.dateOfBirth), [patient?.dateOfBirth]);

  const toothConditionMap = useMemo(() => {
    const result: Record<string, ConditionKey | null> = {};
    for (const toothNumber of RING_TEETH) result[toothNumber] = null;

    const orderedTreatments = typedVisitTreatments
      .slice()
      .sort((a, b) => new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime());

    for (const row of orderedTreatments) {
      const fromChart = parseChartConditionMap(row.notes);
      const chartEntries = Object.entries(fromChart);
      if (chartEntries.length > 0) {
        for (const [tooth, condition] of chartEntries) {
          if (tooth in result) {
            result[tooth] = condition;
          }
        }
        continue;
      }

      const legacyCondition = parseLegacyCondition(row.notes);
      const legacyTooth = row.toothNumber || row.tooth?.toothNumber || toothById.get(String(row.toothId)) || parseLegacyTooth(row.notes);
      if (legacyCondition && legacyTooth && legacyTooth in result) {
        result[legacyTooth] = legacyCondition;
      }
    }

    return result;
  }, [typedVisitTreatments, toothById]);

  const conditionStats = useMemo(() => {
    const totalTeeth = RING_TEETH.length;
    const entries = Object.keys(CONDITIONS).map((conditionKey) => {
      const key = conditionKey as ConditionKey;
      const count = RING_TEETH.filter((tooth) => toothConditionMap[tooth] === key).length;
      return { count, key, percent: Math.round((count / totalTeeth) * 100) };
    });

    const affected = RING_TEETH.filter((tooth) => Boolean(toothConditionMap[tooth])).length;
    const overall = totalTeeth === 0 ? 0 : Math.max(0, Math.round(((totalTeeth - affected) / totalTeeth) * 100));
    return { entries, overall };
  }, [toothConditionMap]);

  const latestVisit = useMemo(() => {
    if (visits.length === 0) return null;
    return visits
      .slice()
      .sort((a, b) => new Date(b.visitDate || '').getTime() - new Date(a.visitDate || '').getTime())[0];
  }, [visits]);

  const orderedVisits = useMemo(
    () =>
      visits
        .slice()
        .sort((a, b) => new Date(b.visitDate || '').getTime() - new Date(a.visitDate || '').getTime()),
    [visits]
  );
  const fetchCsrfClient = async (): Promise<AxiosClient> => {
    const client = new AxiosClient();
    await client.get('/sanctum/csrf-cookie');
    return client;
  };

  const invalidateTasks = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: tasksQueryKey });
  };

  const createTaskMutation = useMutation({
    mutationFn: async (payload: {
      mark: string;
      notes: string;
      status: SessionTaskStatus;
      title: string;
    }) => {
      const client = await fetchCsrfClient();
      return client.post<SessionTask>(
        `/api/v1/dental-management/patients/${patientId}/session-tasks`,
        payload
      );
    },
    onSettled: invalidateTasks,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<Pick<SessionTask, 'mark' | 'notes' | 'status' | 'title'>> }) => {
      const client = await fetchCsrfClient();
      return client.put<SessionTask>(
        `/api/v1/dental-management/patients/${patientId}/session-tasks/${id}`,
        payload
      );
    },
    onSettled: invalidateTasks,
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      const client = await fetchCsrfClient();
      return client.delete<null>(
        `/api/v1/dental-management/patients/${patientId}/session-tasks/${id}`
      );
    },
    onSettled: invalidateTasks,
  });

  const handleAddTask = async (): Promise<void> => {
    const normalizedTitle = taskTitle.trim();
    const normalizedNotes = taskNotes.trim();
    if (!normalizedTitle || !patientId) return;

    setTaskError('');
    const response = await createTaskMutation.mutateAsync({
      mark: taskMark,
      notes: normalizedNotes,
      status: taskStatus,
      title: normalizedTitle,
    });

    if (!response.success) {
      setTaskError(response.error?.message || 'Failed to create task.');
      return;
    }

    setTaskTitle('');
    setTaskMark('blue');
    setTaskNotes('');
    setTaskStatus('pending');
  };

  const handleDeleteTask = async (taskId: number): Promise<void> => {
    setTaskError('');
    const response = await deleteTaskMutation.mutateAsync(taskId);

    if (!response.success) {
      setTaskError(response.error?.message || 'Failed to delete task.');
    }
  };

  const handleStatusChange = async (taskId: number, nextStatus: SessionTaskStatus): Promise<void> => {
    setTaskError('');
    const response = await updateTaskMutation.mutateAsync({
      id: taskId,
      payload: { status: nextStatus },
    });

    if (!response.success) {
      setTaskError(response.error?.message || 'Failed to update task status.');
    }
  };

  const isTaskMutationLoading = createTaskMutation.isPending || updateTaskMutation.isPending || deleteTaskMutation.isPending;

  const breadcrumbs = useMemo(
    () => [
      { id: 'dentalManagement', label: tSidebar('title') },
      { href: `/${locale}/dental-management/patients`, id: 'patients', label: 'Patients' },
      { id: 'patientProfile', isCurrent: true, label: fullName },
    ],
    [fullName, locale, tSidebar]
  );

  if (!patientId) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Invalid patient id.</p>
      </div>
    );
  }

  return (
    <>
      <Header breadcrumbs={breadcrumbs} />
      <div className="flex flex-1 flex-col px-4 pb-6 lg:px-6">
        <div className="rounded-3xl border border-border bg-background p-4 text-foreground shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                router.push(`/${locale}/dental-management/patients`);
              }}
            >
              <ArrowLeft className="me-2 size-4" />
              Back To Patients
            </Button>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <Card className="border-border bg-card text-card-foreground">
                <CardContent className="p-4">
                  <div className="grid gap-4 md:grid-cols-[auto_1fr_1fr] md:items-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
                      {fullName.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xl font-semibold">{isLoadingPatient ? 'Loading...' : fullName}</p>
                      <p className="text-sm text-muted-foreground">{patient?.patientCode || '-'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <p>Age: <span className="font-semibold text-foreground">{patientAge ?? '-'}</span></p>
                      <p>Sex: <span className="font-semibold text-foreground">{patient?.gender || '-'}</span></p>
                      <p>Blood: <span className="font-semibold text-foreground">{patient?.bloodGroup || '-'}</span></p>
                      <p>Tel: <span className="font-semibold text-foreground">{patient?.contactNumber || '-'}</span></p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card text-card-foreground">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Dental Condition</span>
                    <HeartPulse className="size-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-[120px_1fr]">
                  <div className="mx-auto flex size-28 items-center justify-center rounded-full border-4 border-primary bg-background">
                    <div className="text-center">
                      <p className="text-3xl font-bold">{conditionStats.overall}%</p>
                      <p className="text-xs text-muted-foreground">overall</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {conditionStats.entries.map((entry) => (
                      <div key={entry.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-foreground">{CONDITIONS[entry.key].label}</span>
                          <span className="text-muted-foreground">{entry.percent}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              backgroundColor: CONDITIONS[entry.key].color,
                              width: `${entry.percent}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card text-card-foreground">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Session Tasks</span>
                    <ClipboardCheck className="size-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      value={taskTitle}
                      onChange={(event) => {
                        setTaskTitle(event.target.value);
                      }}
                      placeholder="Task title"
                      className="bg-background"
                    />
                    <div className="rounded-md border border-input bg-background p-2">
                      <p className="mb-2 text-xs text-muted-foreground">Mark Color</p>
                      <div className="flex flex-wrap gap-2">
                        {TASK_MARKS.map((mark) => (
                          <button
                            key={mark.value}
                            type="button"
                            onClick={() => {
                              setTaskMark(mark.value);
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${taskMark === mark.value ? 'border-primary' : 'border-border'}`}
                          >
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: mark.color }} />
                            <span>{mark.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <textarea
                    value={taskNotes}
                    onChange={(event) => {
                      setTaskNotes(event.target.value);
                    }}
                    placeholder="Task notes"
                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={taskStatus}
                      onChange={(event) => {
                        setTaskStatus(event.target.value as SessionTaskStatus);
                      }}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                    <Button
                      type="button"
                      onClick={() => {
                        void handleAddTask();
                      }}
                      disabled={!taskTitle.trim() || isTaskMutationLoading}
                      className="bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      Add Task
                    </Button>
                  </div>
                  {taskError ? (
                    <p className="text-xs text-destructive">{taskError}</p>
                  ) : null}

                  <div className="space-y-2">
                    {isLoadingManualTasks ? (
                      <p className="text-sm text-muted-foreground">Loading tasks...</p>
                    ) : manualTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No manual tasks added yet.</p>
                    ) : (
                      manualTasks.map((task) => (
                        <div key={task.id} className="rounded-lg border border-border bg-background p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{task.title}</p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span
                                  className="size-2.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      TASK_MARKS.find((item) => item.value === task.mark)?.color
                                      || '#94a3b8',
                                  }}
                                />
                                <span>
                                  Mark:{' '}
                                  {TASK_MARKS.find((item) => item.value === task.mark)?.label
                                    || task.mark}
                                </span>
                              </p>
                              {task.notes ? (
                                <p className="mt-1 text-xs text-muted-foreground">{task.notes}</p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={task.status}
                                onChange={(event) => {
                                  void handleStatusChange(task.id, event.target.value as SessionTaskStatus);
                                }}
                                disabled={isTaskMutationLoading}
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                              >
                                <option value="pending">Pending</option>
                                <option value="in_progress">In Progress</option>
                                <option value="done">Done</option>
                              </select>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-8"
                                disabled={isTaskMutationLoading}
                                onClick={() => {
                                  void handleDeleteTask(task.id);
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card text-card-foreground">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Patient Visits</span>
                    <CalendarDays className="size-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {orderedVisits.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
                  ) : (
                    orderedVisits.map((visit) => (
                      <div key={visit.id} className="rounded-lg border border-border bg-background p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {visit.tag || visit.appointmentTag || `Visit #${visit.id}`}
                          </p>
                          <p className="text-xs text-muted-foreground">{visit.visitDate || '-'}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Dentist: {visit.dentistName || visit.dentistId || '-'}
                        </p>
                        {visit.nextVisitDate ? (
                          <p className="text-xs text-muted-foreground">Next Visit: {visit.nextVisitDate}</p>
                        ) : null}
                        {visit.diagnosisNotes ? (
                          <p className="mt-1 text-xs text-muted-foreground">{visit.diagnosisNotes}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border bg-card text-card-foreground">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Details</span>
                    <UserRound className="size-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                  <p>Email: <span className="text-foreground">{patient?.email || '-'}</span></p>
                  <p>Address: <span className="text-foreground">{patient?.address || '-'}</span></p>
                  <p>Emergency: <span className="text-foreground">{patient?.emergencyContact || '-'}</span></p>
                  <p>Latest Visit: <span className="text-foreground">{latestVisit?.visitDate || '-'}</span></p>
                  <p>Status: <span className="text-foreground">{patient?.status || '-'}</span></p>
                  <p>Visit Count: <span className="text-foreground">{visits.length}</span></p>
                  <p>Treatments: <span className="text-foreground">{typedVisitTreatments.length}</span></p>
                  <p className="md:col-span-2">Remarks: <span className="text-foreground">{patient?.remarks || '-'}</span></p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border bg-card text-card-foreground">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Dental Scheme</span>
                  <Stethoscope className="size-4 text-primary" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mx-auto h-[360px] w-[360px] max-w-full">
                  {RING_TEETH.map((toothNumber, index) => {
                    const angle = (index / RING_TEETH.length) * Math.PI * 2 - Math.PI / 2;
                    const markerRadius = 38;
                    const labelRadius = 47;
                    const markerX = 50 + markerRadius * Math.cos(angle);
                    const markerY = 50 + markerRadius * Math.sin(angle);
                    const labelX = 50 + labelRadius * Math.cos(angle);
                    const labelY = 50 + labelRadius * Math.sin(angle);
                    const condition = toothConditionMap[toothNumber];

                    return (
                      <div key={toothNumber}>
                        <div
                          className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-sm"
                          style={{
                            backgroundColor: condition ? CONDITIONS[condition].color : '#d6ccc2',
                            borderColor: condition ? CONDITIONS[condition].color : '#c6ac8f',
                            left: `${markerX}%`,
                            top: `${markerY}%`,
                          }}
                        />
                        <span
                          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground"
                          style={{
                            left: `${labelX}%`,
                            top: `${labelY}%`,
                          }}
                        >
                          {toothNumber}
                        </span>
                      </div>
                    );
                  })}

                  <div className="absolute left-1/2 top-1/2 flex size-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-border bg-background">
                    <Sparkles className="size-5 text-primary" />
                    <p className="mt-1 text-xs text-muted-foreground">Teeth Map</p>
                    <p className="text-sm font-semibold text-foreground">{RING_TEETH.length} teeth</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(CONDITIONS).map(([key, condition]) => (
                    <div key={key} className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: condition.color }}
                      />
                      <span className="text-foreground">{condition.label}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {isLoadingTreatments ? (
                    <span>Loading treatment chart...</span>
                  ) : (
                    <span>{typedVisitTreatments.length} recorded treatment entries</span>
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
