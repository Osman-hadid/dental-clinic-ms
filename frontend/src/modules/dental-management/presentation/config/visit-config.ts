import { type EntityModuleConfig } from '@/types/EntityModuleConfig';

const visitAppointmentLabel = (row: any): string => {
  if (typeof row?.appointmentTag === 'string' && row.appointmentTag.trim()) {
    return row.appointmentTag.trim();
  }

  if (typeof row?.appointment?.tag === 'string' && row.appointment.tag.trim()) {
    return row.appointment.tag.trim();
  }

  if (typeof row?.appointment?.name === 'string' && row.appointment.name.trim()) {
    return row.appointment.name.trim();
  }

  return '-';
};

const visitPatientLabel = (row: any): string => {
  if (typeof row?.patientName === 'string' && row.patientName.trim()) {
    return row.patientName.trim();
  }

  const firstName = typeof row?.patient?.firstName === 'string'
    ? row.patient.firstName.trim()
    : (typeof row?.patient?.first_name === 'string' ? row.patient.first_name.trim() : '');
  const lastName = typeof row?.patient?.lastName === 'string'
    ? row.patient.lastName.trim()
    : (typeof row?.patient?.last_name === 'string' ? row.patient.last_name.trim() : '');
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName) {
    return fullName;
  }

  if (typeof row?.patient?.fullName === 'string' && row.patient.fullName.trim()) {
    return row.patient.fullName.trim();
  }

  if (typeof row?.patient?.full_name === 'string' && row.patient.full_name.trim()) {
    return row.patient.full_name.trim();
  }

  if (typeof row?.patient?.name === 'string' && row.patient.name.trim()) {
    return row.patient.name.trim();
  }

  if (typeof row?.patient?.patientCode === 'string' && row.patient.patientCode.trim()) {
    return row.patient.patientCode.trim();
  }

  if (typeof row?.patient?.patient_code === 'string' && row.patient.patient_code.trim()) {
    return row.patient.patient_code.trim();
  }

  return '-';
};

const visitDentistLabel = (row: any): string => {
  if (typeof row?.dentistName === 'string' && row.dentistName.trim()) {
    return row.dentistName.trim();
  }

  if (typeof row?.dentist?.fullName === 'string' && row.dentist.fullName.trim()) {
    return row.dentist.fullName.trim();
  }

  if (typeof row?.dentist?.name === 'string' && row.dentist.name.trim()) {
    return row.dentist.name.trim();
  }

  if (typeof row?.dentist?.full_name === 'string' && row.dentist.full_name.trim()) {
    return row.dentist.full_name.trim();
  }

  const firstName = typeof row?.dentist?.firstName === 'string'
    ? row.dentist.firstName.trim()
    : (typeof row?.dentist?.first_name === 'string' ? row.dentist.first_name.trim() : '');
  const lastName = typeof row?.dentist?.lastName === 'string'
    ? row.dentist.lastName.trim()
    : (typeof row?.dentist?.last_name === 'string' ? row.dentist.last_name.trim() : '');
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName) {
    return fullName;
  }

  return '-';
};

export const visitConfig: EntityModuleConfig = {
  columns: [
    {
      accessorKey: 'tag',
      header: 'config.form.tag.label',
    },
    {
      accessorKey: 'appointmentId',
      header: 'config.form.appointmentId.label',
      cell: visitAppointmentLabel,
    },
    {
      accessorKey: 'patientId',
      header: 'config.form.patientId.label',
      cell: visitPatientLabel,
    },
    {
      accessorKey: 'dentistId',
      header: 'config.form.dentistId.label',
      cell: visitDentistLabel,
    },
    {
      accessorKey: 'visitDate',
      header: 'config.form.visitDate.label',
    },
    {
      accessorKey: 'diagnosisNotes',
      header: 'config.form.diagnosisNotes.label',
    },
    {
      accessorKey: 'nextVisitDate',
      header: 'config.form.nextVisitDate.label',
    },
    {
      accessorKey: 'createdBy',
      header: 'config.form.createdBy.label',
    },
    {
      accessorKey: 'updatedBy',
      header: 'config.form.updatedBy.label',
    },
    {
      accessorKey: 'visitTreatments',
      header: 'config.form.visitTreatments.label',
    },
    {
      accessorKey: 'invoices',
      header: 'config.form.invoices.label',
    },
  ],
  createButton: 'config.table.add',
  createSubmitText: 'config.create',
  createTitle: 'config.table.create',
  editButton: 'config.table.update',
  editSubmitText: 'config.update',
  editTitle: 'config.table.edit',
  entity: 'config.entity',
  filters: [
    {
      key: 'trashed',
      title: 'config.form.trashed.label',
      options: [
        { label: 'config.form.trashed.options.with', value: 'with' },
        { label: 'config.form.trashed.options.only', value: 'only' },
      ],
    },
  ],
  formFields: [
    {
      label: 'config.form.tag.label',
      name: 'tag',
      required: true,
      type: 'text',
      validation: {
        required: 'config.form.tag.validation.required',
        maxLength: { value: 100, message: 'config.form.tag.validation.maxLength' },
      },
    },
    {
      label: 'config.form.appointmentId.label',
      name: 'appointmentId',
      required: false,
      relation: 'appointments',
      type: 'select',
      validation: {},
    },
    {
      label: 'config.form.patientId.label',
      name: 'patientId',
      required: true,
      relation: 'patients',
      type: 'select',
      validation: {
        required: 'config.form.patientId.validation.required',
      },
    },
    {
      label: 'config.form.dentistId.label',
      name: 'dentistId',
      required: true,
      relation: 'staff',
      type: 'select',
      validation: {
        required: 'config.form.dentistId.validation.required',
      },
    },
    {
      label: 'config.form.visitDate.label',
      name: 'visitDate',
      required: true,
      type: 'date',
      validation: {
        required: 'config.form.visitDate.validation.required',
        maxLength: { value: 255, message: 'config.form.visitDate.validation.maxLength' },
      },
    },
    {
      label: 'config.form.diagnosisNotes.label',
      name: 'diagnosisNotes',
      required: false,
      type: 'textarea',
      validation: {
        maxLength: { value: 255, message: 'config.form.diagnosisNotes.validation.maxLength' },
      },
    },
    {
      label: 'config.form.nextVisitDate.label',
      name: 'nextVisitDate',
      required: false,
      type: 'date',
      validation: {
        maxLength: { value: 255, message: 'config.form.nextVisitDate.validation.maxLength' },
      },
    },
  ],
  queryKey: 'visits',
  searchFields: [
    { label: 'config.form.tag.label', value: 'tag' },
    { label: 'config.form.diagnosisNotes.label', value: 'diagnosisNotes' },
  ],
  singleQueryKey: 'visit',
  title: 'config.title',
  sortableColumns: ['id', 'tag', 'visitDate', 'createdAt'],
  relations: ['appointment', 'patient', 'dentist'],
  permissions: {
    view: 'dental-management.visits.view',
    create: 'dental-management.visits.create',
    update: 'dental-management.visits.update',
    delete: 'dental-management.visits.delete',
    bulkDelete: 'dental-management.visits.bulk-delete',
  },
};
