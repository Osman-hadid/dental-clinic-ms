import { type EntityModuleConfig } from '@/types/EntityModuleConfig';

export const paymentConfig: EntityModuleConfig = {
  columns: [
    {
      accessorKey: 'invoiceId',
      header: 'config.form.invoiceId.label',
    },
    {
      accessorKey: 'paymentDate',
      header: 'config.form.paymentDate.label',
    },
    {
      accessorKey: 'amount',
      header: 'config.form.amount.label',
    },
    {
      accessorKey: 'method',
      header: 'config.form.method.label',
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
      key: 'method',
      title: 'config.form.method.label',
      options: [
        { label: 'config.form.method.options.cash', value: 'cash' },
        { label: 'config.form.method.options.card', value: 'card' },
        { label: 'config.form.method.options.insurance', value: 'insurance' },
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
      label: 'config.form.invoiceId.label',
      name: 'invoiceId',
      required: true,
      relation: 'invoices',
      type: 'select',
      validation: {
        required: 'config.form.invoiceId.validation.required',
      },
    },
    {
      label: 'config.form.paymentDate.label',
      name: 'paymentDate',
      required: true,
      type: 'date',
      validation: {
        required: 'config.form.paymentDate.validation.required',
        maxLength: { value: 255, message: 'config.form.paymentDate.validation.maxLength' },
      },
    },
    {
      label: 'config.form.amount.label',
      name: 'amount',
      required: true,
      type: 'number',
      validation: {
        required: 'config.form.amount.validation.required',
        maxLength: { value: 255, message: 'config.form.amount.validation.maxLength' },
      },
    },
    {
      label: 'config.form.currency.label',
      name: 'currency',
      required: false,
      type: 'select',
      validation: {
        in: { value: ['AFN', 'USD'], message: 'config.form.currency.validation.in' },
      },
      options: [
        {
          label: 'config.form.currency.options.afn',
          value: 'AFN',
        },
        {
          label: 'config.form.currency.options.usd',
          value: 'USD',
        },
      ],
    },
    {
      label: 'config.form.exchangeRate.label',
      name: 'exchangeRate',
      required: false,
      type: 'number',
      validation: {
        maxLength: { value: 255, message: 'config.form.exchangeRate.validation.maxLength' },
      },
    },
    {
      label: 'config.form.method.label',
      name: 'method',
      required: true,
      type: 'select',
      validation: {
        required: 'config.form.method.validation.required',
        in: { value: ['cash', 'card', 'insurance'], message: 'config.form.method.validation.in' },
      },
      options: [
        {
          label: 'config.form.method.options.cash',
          value: 'cash',
        },
        {
          label: 'config.form.method.options.card',
          value: 'card',
        },
        {
          label: 'config.form.method.options.insurance',
          value: 'insurance',
        },
      ],
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
  ],
  queryKey: 'payments',
  searchFields: [{ label: 'config.form.notes.label', value: 'notes' }],
  singleQueryKey: 'payment',
  title: 'config.title',
  sortableColumns: ['id', 'paymentDate', 'amount', 'createdAt'],
  relations: ['invoice'],
  permissions: {
    view: 'dental-management.payments.view',
    create: 'dental-management.payments.create',
    update: 'dental-management.payments.update',
    delete: 'dental-management.payments.delete',
    bulkDelete: 'dental-management.payments.bulk-delete',
  },
};
