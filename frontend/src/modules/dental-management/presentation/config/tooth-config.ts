import { type EntityModuleConfig } from '@/types/EntityModuleConfig';

export const toothConfig: EntityModuleConfig = {
  columns: [
    {
      accessorKey: 'toothNumber',
      header: 'config.form.toothNumber.label',
    },
    {
      accessorKey: 'description',
      header: 'config.form.description.label',
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
  ],
  createButton: 'config.table.add',
  createSubmitText: 'config.create',
  createTitle: 'config.table.create',
  editButton: 'config.table.update',
  editSubmitText: 'config.update',
  editTitle: 'config.table.edit',
  entity: 'config.entity',
  filters: [],
  formFields: [
    {
      label: 'config.form.toothNumber.label',
      name: 'toothNumber',
      required: true,
      type: 'text',
      validation: {
        required: 'config.form.toothNumber.validation.required',
        maxLength: { value: 255, message: 'config.form.toothNumber.validation.maxLength' },
      },
    },
    {
      label: 'config.form.description.label',
      name: 'description',
      required: false,
      type: 'text',
      validation: {
        maxLength: { value: 255, message: 'config.form.description.validation.maxLength' },
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
  ],
  queryKey: 'teeth',
  searchFields: [
    { label: 'config.form.toothNumber.label', value: 'toothNumber' },
    { label: 'config.form.description.label', value: 'description' },
  ],
  singleQueryKey: 'tooth',
  title: 'config.title',
  sortableColumns: ['id', 'toothNumber', 'createdAt'],
  relations: [],
  permissions: {
    view: 'dental-management.teeth.view',
    create: 'dental-management.teeth.create',
    update: 'dental-management.teeth.update',
    delete: 'dental-management.teeth.delete',
    bulkDelete: 'dental-management.teeth.bulk-delete',
  },
};
