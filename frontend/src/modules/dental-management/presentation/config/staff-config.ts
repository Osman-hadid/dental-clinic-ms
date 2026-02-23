import { type EntityModuleConfig } from '@/types/EntityModuleConfig';

export const staffConfig: EntityModuleConfig = {
  columns: [
    {
      accessorKey: 'fullName',
      header: 'config.form.fullName.label',
    },
    {
      accessorKey: 'role',
      header: 'config.form.role.label',
    },
    {
      accessorKey: 'specialization',
      header: 'config.form.specialization.label',
    },
    {
      accessorKey: 'contactNumber',
      header: 'config.form.contactNumber.label',
    },
    {
      accessorKey: 'email',
      header: 'config.form.email.label',
    },
    {
      accessorKey: 'hireDate',
      header: 'config.form.hireDate.label',
    },
    {
      accessorKey: 'remarks',
      header: 'config.form.remarks.label',
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
    {
      accessorKey: 'appointments',
      header: 'config.form.appointments.label',
    },
    {
      accessorKey: 'visits',
      header: 'config.form.visits.label',
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
  filters: [
    {
      key: 'role',
      title: 'config.form.role.label',
      options: [
        { label: 'config.form.role.options.dentist', value: 'dentist' },
        { label: 'config.form.role.options.assistant', value: 'assistant' },
        { label: 'config.form.role.options.reception', value: 'reception' },
        { label: 'config.form.role.options.admin', value: 'admin' },
      ],
    },
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
      label: 'config.form.fullName.label',
      name: 'fullName',
      required: true,
      type: 'text',
      validation: {
        required: 'config.form.fullName.validation.required',
        maxLength: { value: 255, message: 'config.form.fullName.validation.maxLength' },
      },
    },
    {
      label: 'config.form.role.label',
      name: 'role',
      required: true,
      type: 'select',
      validation: {
        required: 'config.form.role.validation.required',
        in: {
          value: ['dentist', 'assistant', 'reception', 'admin'],
          message: 'config.form.role.validation.in',
        },
      },
      options: [
        {
          label: 'config.form.role.options.dentist',
          value: 'dentist',
        },
        {
          label: 'config.form.role.options.assistant',
          value: 'assistant',
        },
        {
          label: 'config.form.role.options.reception',
          value: 'reception',
        },
        {
          label: 'config.form.role.options.admin',
          value: 'admin',
        },
      ],
    },
    {
      label: 'config.form.specialization.label',
      name: 'specialization',
      required: false,
      type: 'text',
      validation: {
        maxLength: { value: 255, message: 'config.form.specialization.validation.maxLength' },
      },
    },
    {
      label: 'config.form.contactNumber.label',
      name: 'contactNumber',
      required: false,
      type: 'text',
      validation: {
        maxLength: { value: 255, message: 'config.form.contactNumber.validation.maxLength' },
      },
    },
    {
      label: 'config.form.email.label',
      name: 'email',
      required: false,
      type: 'email',
      validation: {
        pattern: {
          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          message: 'config.form.email.validation.email',
        },
        maxLength: { value: 255, message: 'config.form.email.validation.maxLength' },
      },
    },
    {
      label: 'config.form.hireDate.label',
      name: 'hireDate',
      required: false,
      type: 'date',
      validation: {
        maxLength: { value: 255, message: 'config.form.hireDate.validation.maxLength' },
      },
    },
    {
      label: 'config.form.remarks.label',
      name: 'remarks',
      required: false,
      type: 'textarea',
      validation: {
        maxLength: { value: 255, message: 'config.form.remarks.validation.maxLength' },
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
      label: 'config.form.enabled.label',
      name: 'enabled',
      required: false,
      type: 'checkbox',
    },
    {
      label: 'config.form.appointments.label',
      name: 'appointments',
      required: false,
      type: 'multiselect',
    },
    {
      label: 'config.form.visits.label',
      name: 'visits',
      required: false,
      type: 'multiselect',
    },
    {
      label: 'config.form.visitTreatments.label',
      name: 'visitTreatments',
      required: false,
      type: 'multiselect',
    },
  ],
  queryKey: 'staff',
  searchFields: [
    { label: 'config.form.fullName.label', value: 'fullName' },
    { label: 'config.form.specialization.label', value: 'specialization' },
    { label: 'config.form.contactNumber.label', value: 'contactNumber' },
    { label: 'config.form.email.label', value: 'email' },
  ],
  singleQueryKey: 'staff',
  title: 'config.title',
  sortableColumns: ['id', 'fullName', 'role', 'createdAt'],
  relations: [],
  permissions: {
    view: 'dental-management.staff.view',
    create: 'dental-management.staff.create',
    update: 'dental-management.staff.update',
    delete: 'dental-management.staff.delete',
    bulkDelete: 'dental-management.staff.bulk-delete',
  },
};
