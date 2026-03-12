import { type EntityModuleConfig } from '@/types/EntityModuleConfig';

export const visitTreatmentConfig: EntityModuleConfig = {
  columns: [
    {
      accessorKey: 'visitId',
      header: 'config.form.visitId.label',
    },
    {
      accessorKey: 'treatmentId',
      header: 'config.form.treatmentId.label',
    },
    {
      accessorKey: 'toothId',
      header: 'config.form.toothId.label',
    },
    {
      accessorKey: 'dentistId',
      header: 'config.form.dentistId.label',
    },
    {
      accessorKey: 'price',
      header: 'config.form.price.label',
    },
    {
      accessorKey: 'material',
      header: 'config.form.material.label',
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
      label: 'config.form.visitId.label',
      name: 'visitId',
      required: true,
      relation: 'visits',
      type: 'select',
      validation: {
        required: 'config.form.visitId.validation.required',
      },
    },
    {
      label: 'config.form.treatmentId.label',
      name: 'treatmentId',
      required: true,
      relation: 'treatments',
      type: 'select',
      validation: {
        required: 'config.form.treatmentId.validation.required',
      },
    },
    {
      label: 'config.form.toothId.label',
      name: 'toothId',
      required: false,
      relation: 'teeth',
      type: 'select',
    },
    {
      label: 'config.form.dentistId.label',
      name: 'dentistId',
      required: false,
      relation: 'staff',
      type: 'select',
    },
    {
      label: 'config.form.price.label',
      name: 'price',
      required: true,
      type: 'number',
      validation: {
        required: 'config.form.price.validation.required',
        maxLength: { value: 255, message: 'config.form.price.validation.maxLength' },
      },
    },
    {
      label: 'config.form.material.label',
      name: 'material',
      required: false,
      type: 'text',
      validation: {
        maxLength: { value: 255, message: 'config.form.material.validation.maxLength' },
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
    // {
    //   label: 'config.form.createdBy.label',
    //   name: 'createdBy',
    //   required: false,
    //   type: 'number',
    // },
    // {
    //   label: 'config.form.updatedBy.label',
    //   name: 'updatedBy',
    //   required: false,
    //   type: 'number',
    // },
  ],
  queryKey: 'visitTreatments',
  searchFields: [
    { label: 'config.form.material.label', value: 'material' },
    { label: 'config.form.notes.label', value: 'notes' },
  ],
  singleQueryKey: 'visitTreatment',
  title: 'config.title',
  sortableColumns: ['id', 'price', 'createdAt'],
  relations: ['visit', 'treatment', 'tooth', 'dentist'],
  permissions: {
    view: 'dental-management.visit-treatments.view',
    create: 'dental-management.visit-treatments.create',
    update: 'dental-management.visit-treatments.update',
    delete: 'dental-management.visit-treatments.delete',
    bulkDelete: 'dental-management.visit-treatments.bulk-delete',
  },
};
