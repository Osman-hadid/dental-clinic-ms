import { type EntityModuleConfig } from '@/types/EntityModuleConfig';

export const appointmentConfig: EntityModuleConfig = {
  columns: [
    {
      accessorKey: 'patientId',
      header: 'config.form.patientId.label',
    },
    {
      accessorKey: 'dentistId',
      header: 'config.form.dentistId.label',
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
      label: 'config.form.patientId.label',
      name: 'patientId',
      required: true,
      type: 'number',
      validation: {
        required: 'config.form.patientId.validation.required',
      },
    },
    {
      label: 'config.form.dentistId.label',
      name: 'dentistId',
      required: true,
      type: 'number',
      validation: {
        required: 'config.form.dentistId.validation.required',
      },
    },
    {
      label: 'config.form.appointmentDate.label',
      name: 'appointmentDate',
      required: true,
      type: 'text',
      validation: {
        required: 'config.form.appointmentDate.validation.required',
        maxLength: { value: 255, message: 'config.form.appointmentDate.validation.maxLength' },
      },
    },
    {
      label: 'config.form.startTime.label',
      name: 'startTime',
      required: true,
      type: 'text',
      validation: {
        required: 'config.form.startTime.validation.required',
        maxLength: { value: 255, message: 'config.form.startTime.validation.maxLength' },
      },
    },
    {
      label: 'config.form.endTime.label',
      name: 'endTime',
      required: false,
      type: 'text',
      validation: {
        maxLength: { value: 255, message: 'config.form.endTime.validation.maxLength' },
      },
    },
    {
      label: 'config.form.notes.label',
      name: 'notes',
      required: false,
      type: 'text',
      validation: {
        maxLength: { value: 255, message: 'config.form.notes.validation.maxLength' },
      },
    },
    {
      label: 'config.form.createdBy.label',
      name: 'createdBy',
      required: false,
      type: 'number',
    },
    {
      label: 'config.form.updatedBy.label',
      name: 'updatedBy',
      required: false,
      type: 'number',
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
    {
      label: 'config.form.visits.label',
      name: 'visits',
      required: false,
      type: 'multiselect',
    },
  ],
  queryKey: 'appointments',
  searchFields: [{ label: 'config.form.notes.label', value: 'notes' }],
  singleQueryKey: 'appointment',
  title: 'config.title',
  sortableColumns: ['id', 'appointmentDate', 'startTime', 'status', 'createdAt'],
  relations: ['patient', 'dentist'],
  permissions: {
    view: 'dental-management.appointments.view',
    create: 'dental-management.appointments.create',
    update: 'dental-management.appointments.update',
    delete: 'dental-management.appointments.delete',
    bulkDelete: 'dental-management.appointments.bulk-delete',
  },
};
