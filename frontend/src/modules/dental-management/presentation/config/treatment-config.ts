import { type EntityModuleConfig } from '@/types/EntityModuleConfig';

export const treatmentConfig: EntityModuleConfig = {
  columns: [
    {
      accessorKey: 'name',
      header: 'config.form.name.label',
    },
    {
      accessorKey: 'category',
      header: 'config.form.category.label',
    },
    {
      accessorKey: 'defaultPrice',
      header: 'config.form.defaultPrice.label',
    },
    {
      accessorKey: 'durationMinutes',
      header: 'config.form.durationMinutes.label',
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
      accessorKey: 'enabled',
      header: 'config.form.enabled.label',
    },
    // {
    //   accessorKey: 'visitTreatments',
    //   header: 'config.form.visitTreatments.label',
    // },
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
      key: 'enabled',
      title: 'config.form.enabled.label',
      options: [
        { label: 'config.form.enabled.options.active', value: '1' },
        { label: 'config.form.enabled.options.inactive', value: '0' },
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
      label: 'config.form.name.label',
      name: 'name',
      required: true,
      type: 'text',
      validation: {
        required: 'config.form.name.validation.required',
        maxLength: { value: 255, message: 'config.form.name.validation.maxLength' },
      },
    },
    {
      label: 'config.form.category.label',
      name: 'category',
      required: true,
      type: 'text',
      validation: {
        required: 'config.form.category.validation.required',
        maxLength: { value: 255, message: 'config.form.category.validation.maxLength' },
      },
    },
    {
      label: 'config.form.defaultPrice.label',
      name: 'defaultPrice',
      required: true,
      type: 'text',
      validation: {
        required: 'config.form.defaultPrice.validation.required',
        maxLength: { value: 255, message: 'config.form.defaultPrice.validation.maxLength' },
      },
    },
    {
      label: 'config.form.durationMinutes.label',
      name: 'durationMinutes',
      required: false,
      type: 'number',
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
    {
      label: 'config.form.enabled.label',
      name: 'enabled',
      required: false,
      type: 'checkbox',
    },
    // {
    //   label: 'config.form.visitTreatments.label',
    //   name: 'visitTreatments',
    //   required: false,
    //   type: 'multiselect',
    // },
  ],
  queryKey: 'treatments',
  searchFields: [
    { label: 'config.form.name.label', value: 'name' },
    { label: 'config.form.category.label', value: 'category' },
    { label: 'config.form.description.label', value: 'description' },
  ],
  singleQueryKey: 'treatment',
  title: 'config.title',
  sortableColumns: ['id', 'name', 'category', 'createdAt'],
  relations: [],
  permissions: {
    view: 'dental-management.treatments.view',
    create: 'dental-management.treatments.create',
    update: 'dental-management.treatments.update',
    delete: 'dental-management.treatments.delete',
    bulkDelete: 'dental-management.treatments.bulk-delete',
  },
};
