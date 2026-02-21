import { type EntityModuleConfig } from '@/types/EntityModuleConfig';

export const moduleConfig: EntityModuleConfig = {
  columns: [
    {
      accessorKey: 'nameEn',
      header: 'config.form.nameEn.label',
    },
    {
      accessorKey: 'namePs',
      header: 'config.form.namePs.label',
    },
    {
      accessorKey: 'nameDr',
      header: 'config.form.nameDr.label',
    },
    {
      accessorKey: 'url',
      header: 'config.form.url.label',
    },
    {
      accessorKey: 'description',
      header: 'config.form.description.label',
    },
    {
      accessorKey: 'sortOrder',
      header: 'config.form.sortOrder.label',
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
      label: 'config.form.nameEn.label',
      name: 'nameEn',
      required: true,
      type: 'text',
      validation: {
        maxLength: { message: 'config.form.nameEn.validation.maxLength', value: 255 },
        required: 'config.form.nameEn.validation.required',
      },
    },
    {
      label: 'config.form.namePs.label',
      name: 'namePs',
      required: false,
      type: 'text',
      validation: {
        maxLength: { message: 'config.form.namePs.validation.maxLength', value: 255 },
      },
    },
    {
      label: 'config.form.nameDr.label',
      name: 'nameDr',
      required: false,
      type: 'text',
      validation: {
        maxLength: { message: 'config.form.nameDr.validation.maxLength', value: 255 },
      },
    },
    {
      label: 'config.form.url.label',
      name: 'url',
      required: true,
      type: 'text',
      validation: {
        maxLength: { message: 'config.form.url.validation.maxLength', value: 255 },
        required: 'config.form.url.validation.required',
      },
    },
    {
      label: 'config.form.description.label',
      name: 'description',
      required: false,
      type: 'text',
      validation: {
        maxLength: { message: 'config.form.description.validation.maxLength', value: 255 },
      },
    },
    {
      label: 'config.form.sortOrder.label',
      name: 'sortOrder',
      required: false,
      type: 'number',
    },
  ],
  permissions: {
    bulkDelete: 'settings.modules.bulk-delete',
    create: 'settings.modules.create',
    delete: 'settings.modules.delete',
    update: 'settings.modules.update',
    view: 'settings.modules.view',
  },
  queryKey: 'modules',
  relations: [],
  searchFields: [{ label: 'config.form.name.label', value: 'name' }],
  singleQueryKey: 'module',
  sortableColumns: ['id', 'nameEn', 'createdAt'],
  title: 'config.title',
};
