import { type EntityModuleConfig } from '@/types/EntityModuleConfig';

export const invoiceConfig: EntityModuleConfig = {
  columns: [
    {
      accessorKey: 'patientId',
      header: 'config.form.patientId.label',
    },
    {
      accessorKey: 'visitId',
      header: 'config.form.visitId.label',
    },
    {
      accessorKey: 'totalAmount',
      header: 'config.form.totalAmount.label',
    },
    {
      accessorKey: 'netAmount',
      header: 'config.form.netAmount.label',
    },
    {
      accessorKey: 'invoiceDate',
      header: 'config.form.invoiceDate.label',
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
      accessorKey: 'discount',
      header: 'config.form.discount.label',
    },
    {
      accessorKey: 'status',
      header: 'config.form.status.label',
    },
    {
      accessorKey: 'payments',
      header: 'config.form.payments.label',
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
        { label: 'config.form.status.options.unpaid', value: 'unpaid' },
        { label: 'config.form.status.options.partially_paid', value: 'partially_paid' },
        { label: 'config.form.status.options.paid', value: 'paid' },
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
      label: 'config.form.visitId.label',
      name: 'visitId',
      required: true,
      type: 'number',
      validation: {
        required: 'config.form.visitId.validation.required',
      },
    },
    {
      label: 'config.form.totalAmount.label',
      name: 'totalAmount',
      required: true,
      type: 'text',
      validation: {
        required: 'config.form.totalAmount.validation.required',
        maxLength: { value: 255, message: 'config.form.totalAmount.validation.maxLength' },
      },
    },
    {
      label: 'config.form.netAmount.label',
      name: 'netAmount',
      required: true,
      type: 'text',
      validation: {
        required: 'config.form.netAmount.validation.required',
        maxLength: { value: 255, message: 'config.form.netAmount.validation.maxLength' },
      },
    },
    {
      label: 'config.form.invoiceDate.label',
      name: 'invoiceDate',
      required: true,
      type: 'text',
      validation: {
        required: 'config.form.invoiceDate.validation.required',
        maxLength: { value: 255, message: 'config.form.invoiceDate.validation.maxLength' },
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
      label: 'config.form.discount.label',
      name: 'discount',
      required: false,
      type: 'text',
      validation: {
        maxLength: { value: 255, message: 'config.form.discount.validation.maxLength' },
      },
    },
    {
      label: 'config.form.status.label',
      name: 'status',
      required: false,
      type: 'select',
      validation: {
        in: {
          value: ['unpaid', 'partially_paid', 'paid', 'cancelled'],
          message: 'config.form.status.validation.in',
        },
      },
      options: [
        {
          label: 'config.form.status.options.unpaid',
          value: 'unpaid',
        },
        {
          label: 'config.form.status.options.partially_paid',
          value: 'partially_paid',
        },
        {
          label: 'config.form.status.options.paid',
          value: 'paid',
        },
        {
          label: 'config.form.status.options.cancelled',
          value: 'cancelled',
        },
      ],
    },
    {
      label: 'config.form.payments.label',
      name: 'payments',
      required: false,
      type: 'multiselect',
    },
  ],
  queryKey: 'invoices',
  searchFields: [{ label: 'config.form.notes.label', value: 'notes' }],
  singleQueryKey: 'invoice',
  title: 'config.title',
  sortableColumns: ['id', 'invoiceDate', 'netAmount', 'status', 'createdAt'],
  relations: ['patient', 'visit'],
  permissions: {
    view: 'dental-management.invoices.view',
    create: 'dental-management.invoices.create',
    update: 'dental-management.invoices.update',
    delete: 'dental-management.invoices.delete',
    bulkDelete: 'dental-management.invoices.bulk-delete',
  },
};
