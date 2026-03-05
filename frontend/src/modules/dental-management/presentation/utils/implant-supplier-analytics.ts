export type SessionTaskStatus = 'done' | 'in_progress' | 'pending' | string;

export type ImplantAvailabilityStatus = 'not_available' | 'in_purchase' | 'available' | 'done';

export type ImplantSupplierTaskLike = {
  createdAt?: string;
  id: number | string;
  notes?: string;
  patientId?: number | string;
  status?: SessionTaskStatus;
  title?: string;
  updatedAt?: string;
};

export type ImplantSupplierRow = {
  availability: ImplantAvailabilityStatus;
  createdAt: string;
  patientId: string;
  supplierPaid: number;
  supplierRemaining: number;
  supplierTotal: number;
  taskId: number | string;
  toothNumber: string;
};

type AvailabilityBucket = {
  count: number;
  paid: number;
  total: number;
  unpaid: number;
};

export type ImplantSupplierSummary = {
  byAvailability: Record<ImplantAvailabilityStatus, AvailabilityBucket>;
  implantCount: number;
  paidRatio: number;
  rows: ImplantSupplierRow[];
  totalPaid: number;
  totalSupplierCost: number;
  totalUnpaid: number;
  unpaidCount: number;
  unpaidRows: ImplantSupplierRow[];
};

const IMPLANT_TASK_MARKER = 'implant_tooth';
const FALLBACK_TASK_STATUS_TO_AVAILABILITY: Record<string, ImplantAvailabilityStatus> = {
  done: 'done',
  in_progress: 'available',
  pending: 'not_available',
};

const roundAmount = (value: number): number => Number(value.toFixed(2));
const asText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim();
  return '';
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

export const extractImplantToothFromTask = (
  task: Pick<ImplantSupplierTaskLike, 'notes' | 'title'>
): string | null => {
  const notesMatch = task.notes?.match(/\[implant_tooth:([0-9]{2})\]/i);
  if (notesMatch?.[1]) {
    return notesMatch[1];
  }

  const titleMatch = asText(task.title).match(/([0-9]{2})/);
  return titleMatch?.[1] ?? null;
};

export const parseAvailabilityFromTaskNotes = (
  notes?: string,
  taskStatus?: SessionTaskStatus
): ImplantAvailabilityStatus => {
  if (notes) {
    const match = notes.match(/\[implant_availability:(not_available|in_purchase|available|done)\]/i);
    if (match?.[1]) {
      const value = match[1].toLowerCase();
      if (value === 'not_available' || value === 'in_purchase' || value === 'available' || value === 'done') {
        return value;
      }
    }
  }

  const normalizedStatus = asText(taskStatus).toLowerCase();
  return FALLBACK_TASK_STATUS_TO_AVAILABILITY[normalizedStatus] ?? 'not_available';
};

export const isImplantSupplierTask = (task: Pick<ImplantSupplierTaskLike, 'notes' | 'title'>): boolean => {
  const notes = asText(task.notes).toLowerCase();
  if (notes.includes(IMPLANT_TASK_MARKER)) return true;
  return asText(task.title).toLowerCase().includes('implant tooth');
};

const compareRows = (left: ImplantSupplierRow, right: ImplantSupplierRow): number => {
  const leftCreated = new Date(left.createdAt || '').getTime();
  const rightCreated = new Date(right.createdAt || '').getTime();
  const leftCreatedValid = Number.isFinite(leftCreated) ? leftCreated : Number.MIN_SAFE_INTEGER;
  const rightCreatedValid = Number.isFinite(rightCreated) ? rightCreated : Number.MIN_SAFE_INTEGER;
  if (leftCreatedValid !== rightCreatedValid) {
    return leftCreatedValid - rightCreatedValid;
  }

  const leftId = typeof left.taskId === 'number' ? left.taskId : Number.parseInt(String(left.taskId), 10);
  const rightId = typeof right.taskId === 'number' ? right.taskId : Number.parseInt(String(right.taskId), 10);
  const leftIdValid = Number.isFinite(leftId) ? leftId : 0;
  const rightIdValid = Number.isFinite(rightId) ? rightId : 0;
  if (leftIdValid !== rightIdValid) {
    return leftIdValid - rightIdValid;
  }

  return left.toothNumber.localeCompare(right.toothNumber, undefined, { numeric: true });
};

const emptyAvailabilityBuckets = (): Record<ImplantAvailabilityStatus, AvailabilityBucket> => ({
  available: { count: 0, paid: 0, total: 0, unpaid: 0 },
  done: { count: 0, paid: 0, total: 0, unpaid: 0 },
  in_purchase: { count: 0, paid: 0, total: 0, unpaid: 0 },
  not_available: { count: 0, paid: 0, total: 0, unpaid: 0 },
});

export const aggregateImplantSupplierBalances = (
  tasks: ImplantSupplierTaskLike[]
): ImplantSupplierSummary => {
  const byToothKey = new Map<string, ImplantSupplierRow>();

  tasks.forEach((task) => {
    if (!isImplantSupplierTask(task)) return;

    const toothNumber = extractImplantToothFromTask(task);
    if (!toothNumber) return;

    const supplierTotal = parseTaggedAmount(task.notes, 'supplier_total');
    const supplierPaidRaw = parseTaggedAmount(task.notes, 'supplier_paid');
    const supplierPaid = Math.min(supplierTotal, supplierPaidRaw);
    const supplierRemaining = Math.max(0, supplierTotal - supplierPaid);
    const availability = parseAvailabilityFromTaskNotes(task.notes, task.status);
    const patientId = asText(task.patientId);

    const row: ImplantSupplierRow = {
      availability,
      createdAt: asText(task.createdAt),
      patientId,
      supplierPaid: roundAmount(supplierPaid),
      supplierRemaining: roundAmount(supplierRemaining),
      supplierTotal: roundAmount(supplierTotal),
      taskId: task.id,
      toothNumber,
    };

    const dedupeKey = `${patientId || '-'}:${toothNumber}`;
    const previous = byToothKey.get(dedupeKey);
    if (!previous || compareRows(previous, row) <= 0) {
      byToothKey.set(dedupeKey, row);
    }
  });

  const rows = [...byToothKey.values()].sort((left, right) => {
    const byPatient = left.patientId.localeCompare(right.patientId, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (byPatient !== 0) return byPatient;
    return left.toothNumber.localeCompare(right.toothNumber, undefined, { numeric: true });
  });

  const totalSupplierCost = roundAmount(rows.reduce((sum, row) => sum + row.supplierTotal, 0));
  const totalPaid = roundAmount(rows.reduce((sum, row) => sum + row.supplierPaid, 0));
  const totalUnpaid = roundAmount(rows.reduce((sum, row) => sum + row.supplierRemaining, 0));
  const unpaidRows = rows
    .filter((row) => row.supplierRemaining > 0)
    .sort((left, right) => right.supplierRemaining - left.supplierRemaining);
  const byAvailability = emptyAvailabilityBuckets();

  rows.forEach((row) => {
    const bucket = byAvailability[row.availability];
    bucket.count += 1;
    bucket.total = roundAmount(bucket.total + row.supplierTotal);
    bucket.paid = roundAmount(bucket.paid + row.supplierPaid);
    bucket.unpaid = roundAmount(bucket.unpaid + row.supplierRemaining);
  });

  const paidRatio = totalSupplierCost > 0
    ? Number(Math.min(100, (totalPaid / totalSupplierCost) * 100).toFixed(1))
    : 0;

  return {
    byAvailability,
    implantCount: rows.length,
    paidRatio,
    rows,
    totalPaid,
    totalSupplierCost,
    totalUnpaid,
    unpaidCount: unpaidRows.length,
    unpaidRows,
  };
};
