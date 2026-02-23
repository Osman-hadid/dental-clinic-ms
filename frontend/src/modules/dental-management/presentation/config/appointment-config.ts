import { type EntityModuleConfig } from '@/types/EntityModuleConfig';

const appointmentPatientLabel = (row: any): string => {
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

const appointmentDentistLabel = (row: any): string => {
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

export const appointmentConfig: EntityModuleConfig = {
  columns: [
    {
      accessorKey: 'tag',
      header: 'config.form.tag.label',
    },
    {
      accessorKey: 'patientId',
      header: 'config.form.patientId.label',
      cell: appointmentPatientLabel,
    },
    {
      accessorKey: 'dentistId',
      header: 'config.form.dentistId.label',
      cell: appointmentDentistLabel,
    },
    {
      accessorKey: 'appointmentDate',
      header: 'config.form.appointmentDate.label',
    },
    {
      accessorKey: 'startTime',
      header: 'config.form.startTime.label',
    },
    {
      accessorKey: 'endTime',
      header: 'config.form.endTime.label',
    },
    {
      accessorKey: 'notes',
      header: 'config.form.notes.label',
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
      accessorKey: 'status',
      header: 'config.form.status.label',
    },
    {
      accessorKey: 'visits',
      header: 'config.form.visits.label',
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
      key: 'status',
      title: 'config.form.status.label',
      options: [
        { label: 'config.form.status.options.scheduled', value: 'scheduled' },
        { label: 'config.form.status.options.completed', value: 'completed' },
        { label: 'config.form.status.options.cancelled', value: 'cancelled' },
      ],
    },
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
      label: 'config.form.appointmentDate.label',
      name: 'appointmentDate',
      required: true,
      type: 'date',
      validation: {
        required: 'config.form.appointmentDate.validation.required',
        maxLength: { value: 255, message: 'config.form.appointmentDate.validation.maxLength' },
      },
    },
    {
      label: 'config.form.startTime.label',
      name: 'startTime',
      required: true,
      type: 'time',
      validation: {
        required: 'config.form.startTime.validation.required',
        maxLength: { value: 255, message: 'config.form.startTime.validation.maxLength' },
      },
    },
    {
      label: 'config.form.endTime.label',
      name: 'endTime',
      required: true,
      type: 'time',
      validation: {
        required: 'config.form.endTime.validation.required',
        maxLength: { value: 255, message: 'config.form.endTime.validation.maxLength' },
      },
    },
    {
      label: 'config.form.notes.label',
      name: 'notes',
      required: false,
      type: 'textarea',
      validation: {
        maxLength: { value: 255, message: 'config.form.notes.validation.maxLength' },
      },
    },
    {
      label: 'config.form.status.label',
      name: 'status',
      required: false,
      type: 'select',
      validation: {
        in: {
          value: ['scheduled', 'completed', 'cancelled'],
          message: 'config.form.status.validation.in',
        },
      },
      options: [
        {
          label: 'config.form.status.options.scheduled',
          value: 'scheduled',
        },
        {
          label: 'config.form.status.options.completed',
          value: 'completed',
        },
        {
          label: 'config.form.status.options.cancelled',
          value: 'cancelled',
        },
      ],
    },
  ],
  queryKey: 'appointments',
  searchFields: [
    { label: 'config.form.tag.label', value: 'tag' },
    { label: 'config.form.notes.label', value: 'notes' },
  ],
  singleQueryKey: 'appointment',
  title: 'config.title',
  sortableColumns: ['id', 'tag', 'appointmentDate', 'startTime', 'status', 'createdAt'],
  relations: ['patient', 'dentist'],
  permissions: {
    view: 'dental-management.appointments.view',
    create: 'dental-management.appointments.create',
    update: 'dental-management.appointments.update',
    delete: 'dental-management.appointments.delete',
    bulkDelete: 'dental-management.appointments.bulk-delete',
  },
};
