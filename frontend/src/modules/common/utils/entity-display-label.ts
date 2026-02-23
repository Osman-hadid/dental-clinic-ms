type EntityRecord = Record<string, unknown>;

type LabelOptions = {
  relation?: string | null;
};

const asText = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim();
    return normalized;
  }

  return '';
};

const pickFirst = (item: EntityRecord, keys: string[]): string => {
  for (const key of keys) {
    const value = asText(item[key]);
    if (value) {
      return value;
    }
  }

  return '';
};

const normalizeRelation = (relation?: string | null): string => {
  if (!relation) {
    return '';
  }

  const normalized = relation.replace(/[-_\s]/g, '').toLowerCase();
  const aliases: Record<string, string> = {
    appointment: 'appointments',
    dentist: 'staff',
    invoice: 'invoices',
    patient: 'patients',
    payment: 'payments',
    staff: 'staff',
    tooth: 'teeth',
    treatment: 'treatments',
    visit: 'visits',
    visittreatment: 'visittreatments',
  };

  return aliases[normalized] ?? normalized;
};

const buildPatientLabel = (item: EntityRecord): string => {
  const fullName = [asText(item.firstName), asText(item.lastName)].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;

  const code = asText(item.patientCode);
  if (code) return code;

  return '';
};

const buildStaffLabel = (item: EntityRecord): string => {
  const fullName = pickFirst(item, ['fullName', 'name']);
  if (fullName) return fullName;

  const role = asText(item.role);
  return role;
};

const buildAppointmentLabel = (item: EntityRecord): string => {
  const tag = asText(item.tag);
  if (tag) {
    return tag;
  }

  const date = asText(item.appointmentDate);
  const start = asText(item.startTime);
  const end = asText(item.endTime);
  const timeRange = start && end ? `${start}-${end}` : start || end;
  const status = asText(item.status);
  const patient = buildPatientLabel(item) || (asText(item.patientId) ? `Patient ${asText(item.patientId)}` : '');

  const parts = [date, timeRange, patient, status].filter(Boolean);
  if (parts.length > 0) {
    return `Appointment ${parts.join(' | ')}`;
  }

  return '';
};

const buildVisitLabel = (item: EntityRecord): string => {
  const tag = asText(item.tag);
  if (tag) {
    return tag;
  }

  const date = asText(item.visitDate);
  const nextVisit = asText(item.nextVisitDate);
  const patient = buildPatientLabel(item) || (asText(item.patientId) ? `Patient ${asText(item.patientId)}` : '');
  const appointmentId = asText(item.appointmentId);
  const parts = [date, patient, appointmentId ? `Appointment ${appointmentId}` : ''].filter(Boolean);
  const label = parts.length > 0 ? `Visit ${parts.join(' | ')}` : '';

  if (label && nextVisit) {
    return `${label} -> ${nextVisit}`;
  }

  return label;
};

const buildVisitTreatmentLabel = (item: EntityRecord): string => {
  const treatment = pickFirst(item, ['treatmentName', 'name']);
  const toothNumber = asText(item.toothNumber);
  const visitDate = asText(item.visitDate);
  const visitId = asText(item.visitId);
  const treatmentId = asText(item.treatmentId);

  const parts: string[] = [];
  if (treatment) parts.push(treatment);
  if (!treatment && treatmentId) parts.push(`Treatment ${treatmentId}`);
  if (visitId) parts.push(`Visit ${visitId}`);
  if (toothNumber) parts.push(`Tooth ${toothNumber}`);
  if (visitDate) parts.push(visitDate);

  if (parts.length > 0) {
    return `Visit Treatment ${parts.join(' | ')}`;
  }

  return '';
};

const buildInvoiceLabel = (item: EntityRecord): string => {
  const date = asText(item.invoiceDate);
  const amount = asText(item.netAmount) || asText(item.totalAmount);
  const status = asText(item.status);
  const visitId = asText(item.visitId);
  const parts = [date, amount, status, visitId ? `Visit ${visitId}` : ''].filter(Boolean);

  if (parts.length > 0) {
    return `Invoice ${parts.join(' | ')}`;
  }

  return '';
};

const buildPaymentLabel = (item: EntityRecord): string => {
  const date = asText(item.paymentDate);
  const amount = asText(item.amount);
  const method = asText(item.method);
  const invoiceId = asText(item.invoiceId);
  const parts = [date, amount, method, invoiceId ? `Invoice ${invoiceId}` : ''].filter(Boolean);

  if (parts.length > 0) {
    return `Payment ${parts.join(' | ')}`;
  }

  return '';
};

const buildToothLabel = (item: EntityRecord): string => {
  const number = asText(item.toothNumber);
  if (!number) return '';
  return `Tooth ${number}`;
};

const buildTreatmentLabel = (item: EntityRecord): string => {
  const name = asText(item.name);
  const category = asText(item.category);
  if (name && category) return `${name} (${category})`;
  return name || category;
};

const buildGenericLabel = (item: EntityRecord): string => {
  const patient = buildPatientLabel(item);
  if (patient) return patient;

  const staff = buildStaffLabel(item);
  if (staff) return staff;

  const appointment = buildAppointmentLabel(item);
  if (appointment) return appointment;

  const visit = buildVisitLabel(item);
  if (visit) return visit;

  const visitTreatment = buildVisitTreatmentLabel(item);
  if (visitTreatment) return visitTreatment;

  const invoice = buildInvoiceLabel(item);
  if (invoice) return invoice;

  const payment = buildPaymentLabel(item);
  if (payment) return payment;

  const tooth = buildToothLabel(item);
  if (tooth) return tooth;

  const treatment = buildTreatmentLabel(item);
  if (treatment) return treatment;

  const simple = pickFirst(item, ['tag', 'label', 'title', 'displayName', 'email', 'role']);
  if (simple) return simple;

  const id = asText(item.id);
  if (id) return `Record ${id}`;

  return '[Object]';
};

export const buildEntityDisplayLabel = (item: EntityRecord, options?: LabelOptions): string => {
  const relation = normalizeRelation(options?.relation);

  switch (relation) {
    case 'patients':
      return buildPatientLabel(item) || buildGenericLabel(item);
    case 'staff':
      return buildStaffLabel(item) || buildGenericLabel(item);
    case 'appointments':
      return buildAppointmentLabel(item) || buildGenericLabel(item);
    case 'visits':
      return buildVisitLabel(item) || buildGenericLabel(item);
    case 'visittreatments':
      return buildVisitTreatmentLabel(item) || buildGenericLabel(item);
    case 'invoices':
      return buildInvoiceLabel(item) || buildGenericLabel(item);
    case 'payments':
      return buildPaymentLabel(item) || buildGenericLabel(item);
    case 'teeth':
      return buildToothLabel(item) || buildGenericLabel(item);
    case 'treatments':
      return buildTreatmentLabel(item) || buildGenericLabel(item);
    default:
      return buildGenericLabel(item);
  }
};
