import { type EntityModuleConfig } from '@/types/EntityModuleConfig';
import { createElement } from 'react';

const invoicePatientLabel = (row: any): string => {
  const patient = row?.patient;
  if (!patient || typeof patient !== 'object') {
    return '-';
  }

  const firstName = typeof patient.firstName === 'string'
    ? patient.firstName.trim()
    : (typeof patient.first_name === 'string' ? patient.first_name.trim() : '');
  const lastName = typeof patient.lastName === 'string'
    ? patient.lastName.trim()
    : (typeof patient.last_name === 'string' ? patient.last_name.trim() : '');
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName) {
    return fullName;
  }

  if (typeof patient.fullName === 'string' && patient.fullName.trim()) {
    return patient.fullName.trim();
  }

  if (typeof patient.full_name === 'string' && patient.full_name.trim()) {
    return patient.full_name.trim();
  }

  if (typeof patient.name === 'string' && patient.name.trim()) {
    return patient.name.trim();
  }

  if (typeof patient.patientCode === 'string' && patient.patientCode.trim()) {
    return patient.patientCode.trim();
  }

  if (typeof patient.patient_code === 'string' && patient.patient_code.trim()) {
    return patient.patient_code.trim();
  }

  return '-';
};

const invoicePatientCell = (row: any): React.ReactNode => {
  const patientId = String(row?.patientId ?? row?.patient_id ?? '-');
  const patientName = invoicePatientLabel(row);

  return createElement(
    'div',
    { className: 'leading-tight' },
    createElement('div', { className: 'font-medium text-foreground' }, patientId),
    createElement('div', { className: 'text-xs text-muted-foreground' }, patientName)
  );
};

export const invoiceConfig: EntityModuleConfig = {
  columns: [
    {
      accessorKey: 'patientId',
      cell: invoicePatientCell,
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
      accessorKey: 'paymentType',
      header: 'config.form.paymentType.label',
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
      options: [
        { label: 'config.form.status.options.paid', value: 'paid' },
        { label: 'config.form.status.options.unpaid', value: 'unpaid' },
        { label: 'config.form.status.options.partially_paid', value: 'partially_paid' },
        { label: 'config.form.status.options.cancelled', value: 'cancelled' },
      ],
      title: 'config.form.status.label',
    },
    {
      key: 'paymentType',
      options: [
        { label: 'config.form.paymentType.options.cash', value: 'cash' },
        { label: 'config.form.paymentType.options.card', value: 'card' },
        { label: 'config.form.paymentType.options.bank_transfer', value: 'bank_transfer' },
        { label: 'config.form.paymentType.options.insurance', value: 'insurance' },
        { label: 'config.form.paymentType.options.other', value: 'other' },
      ],
      title: 'config.form.paymentType.label',
    },
    {
      key: 'trashed',
      options: [
        { label: 'config.form.trashed.options.with', value: 'with' },
        { label: 'config.form.trashed.options.only', value: 'only' },
      ],
      title: 'config.form.trashed.label',
    },
  ],
  formFields: [
    {
      label: 'config.form.patientId.label',
      name: 'patientId',
      relation: 'patients',
      required: true,
      type: 'select',
      validation: {
        required: 'config.form.patientId.validation.required',
      },
    },
    {
      label: 'config.form.visitId.label',
      name: 'visitId',
      relation: 'visits',
      required: true,
      type: 'select',
      validation: {
        required: 'config.form.visitId.validation.required',
      },
    },
    {
      label: 'config.form.totalAmount.label',
      name: 'totalAmount',
      required: true,
      type: 'number',
      validation: {
        maxLength: { message: 'config.form.totalAmount.validation.maxLength', value: 255 },
        required: 'config.form.totalAmount.validation.required',
      },
    },
    {
      label: 'config.form.netAmount.label',
      name: 'netAmount',
      required: true,
      type: 'number',
      validation: {
        maxLength: { message: 'config.form.netAmount.validation.maxLength', value: 255 },
        required: 'config.form.netAmount.validation.required',
      },
    },
    {
      label: 'config.form.currency.label',
      name: 'currency',
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
      required: false,
      type: 'select',
      validation: {
        in: {
          message: 'config.form.currency.validation.in',
          value: ['AFN', 'USD'],
        },
      },
    },
    {
      label: 'config.form.exchangeRate.label',
      name: 'exchangeRate',
      required: false,
      type: 'number',
      validation: {
        maxLength: { message: 'config.form.exchangeRate.validation.maxLength', value: 255 },
      },
    },
    {
      label: 'config.form.invoiceDate.label',
      name: 'invoiceDate',
      required: true,
      type: 'date',
      validation: {
        maxLength: { message: 'config.form.invoiceDate.validation.maxLength', value: 255 },
        required: 'config.form.invoiceDate.validation.required',
      },
    },
    {
      label: 'config.form.notes.label',
      name: 'notes',
      required: false,
      type: 'text',
      validation: {
        maxLength: { message: 'config.form.notes.validation.maxLength', value: 255 },
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
      type: 'number',
      validation: {
        maxLength: { message: 'config.form.discount.validation.maxLength', value: 255 },
      },
    },
    {
      label: 'config.form.status.label',
      name: 'status',
      options: [
        {
          label: 'config.form.status.options.paid',
          value: 'paid',
        },
        {
          label: 'config.form.status.options.partially_paid',
          value: 'partially_paid',
        },
        {
          label: 'config.form.status.options.unpaid',
          value: 'unpaid',
        },
        {
          label: 'config.form.status.options.cancelled',
          value: 'cancelled',
        },
      ],
      required: false,
      type: 'select',
      validation: {
        in: {
          message: 'config.form.status.validation.in',
          value: ['paid', 'unpaid', 'partially_paid', 'cancelled'],
        },
      },
    },
    {
      label: 'config.form.paymentType.label',
      name: 'paymentType',
      options: [
        {
          label: 'config.form.paymentType.options.cash',
          value: 'cash',
        },
        {
          label: 'config.form.paymentType.options.card',
          value: 'card',
        },
        {
          label: 'config.form.paymentType.options.bank_transfer',
          value: 'bank_transfer',
        },
        {
          label: 'config.form.paymentType.options.insurance',
          value: 'insurance',
        },
        {
          label: 'config.form.paymentType.options.other',
          value: 'other',
        },
      ],
      required: false,
      type: 'select',
      validation: {
        in: {
          message: 'config.form.paymentType.validation.in',
          value: ['cash', 'card', 'bank_transfer', 'insurance', 'other'],
        },
      },
    },
    {
      label: 'config.form.payments.label',
      name: 'payments',
      required: false,
      type: 'multiselect',
    },
  ],
  permissions: {
    bulkDelete: 'dental-management.invoices.bulk-delete',
    create: 'dental-management.invoices.create',
    delete: 'dental-management.invoices.delete',
    update: 'dental-management.invoices.update',
    view: 'dental-management.invoices.view',
  },
  queryKey: 'invoices',
  relations: ['patient', 'visit'],
  searchFields: [{ label: 'config.form.notes.label', value: 'notes' }],
  singleQueryKey: 'invoice',
  sortableColumns: ['id', 'invoiceDate', 'netAmount', 'status', 'paymentType', 'createdAt'],
  title: 'config.title',
};
