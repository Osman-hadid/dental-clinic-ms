import { type EntityModuleConfig } from '@/types/EntityModuleConfig';

export const visitConfig: EntityModuleConfig = {
  columns: [
    {
      accessorKey: 'appointmentId',
      header: 'config.form.appointmentId.label',
    },
    {
      accessorKey: 'patientId',
      header: 'config.form.patientId.label',
    },
    {
      accessorKey: 'dentistId',
      header: 'config.form.dentistId.label',
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
      label: 'config.form.appointmentId.label',
      name: 'appointmentId',
      required: true,
      type: 'number',
      validation: {
        required: 'config.form.appointmentId.validation.required',
      },
    },
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
      label: 'config.form.visitDate.label',
      name: 'visitDate',
      required: true,
      type: 'text',
      validation: {
        required: 'config.form.visitDate.validation.required',
        maxLength: { value: 255, message: 'config.form.visitDate.validation.maxLength' },
      },
    },
    {
      label: 'config.form.diagnosisNotes.label',
      name: 'diagnosisNotes',
      required: false,
      type: 'text',
      validation: {
        maxLength: { value: 255, message: 'config.form.diagnosisNotes.validation.maxLength' },
      },
    },
    {
      label: 'config.form.nextVisitDate.label',
      name: 'nextVisitDate',
      required: false,
      type: 'text',
      validation: {
        maxLength: { value: 255, message: 'config.form.nextVisitDate.validation.maxLength' },
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
      label: 'config.form.visitTreatments.label',
      name: 'visitTreatments',
      required: false,
      type: 'multiselect',
    },
    {
      label: 'config.form.invoices.label',
      name: 'invoices',
      required: false,
      type: 'multiselect',
    },
  ],
  queryKey: 'visits',
  searchFields: [{ label: 'config.form.diagnosisNotes.label', value: 'diagnosisNotes' }],
  singleQueryKey: 'visit',
  title: 'config.title',
  sortableColumns: ['id', 'visitDate', 'createdAt'],
  relations: ['appointment', 'patient', 'dentist'],
  permissions: {
    view: 'dental-management.visits.view',
    create: 'dental-management.visits.create',
    update: 'dental-management.visits.update',
    delete: 'dental-management.visits.delete',
    bulkDelete: 'dental-management.visits.bulk-delete',
  },
};
