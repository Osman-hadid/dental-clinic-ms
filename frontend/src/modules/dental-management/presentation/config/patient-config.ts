import { type EntityModuleConfig } from '@/types/EntityModuleConfig';

export const patientConfig: EntityModuleConfig = {
  columns: [
    {
      accessorKey: 'patientCode',
      header: 'config.form.patientCode.label',
    },
    {
      accessorKey: 'firstName',
      header: 'config.form.firstName.label',
    },
    {
      accessorKey: 'lastName',
      header: 'config.form.lastName.label',
    },
    {
      accessorKey: 'gender',
      header: 'config.form.gender.label',
    },
    {
      accessorKey: 'dateOfBirth',
      header: 'config.form.dateOfBirth.label',
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
      accessorKey: 'address',
      header: 'config.form.address.label',
    },
    {
      accessorKey: 'bloodGroup',
      header: 'config.form.bloodGroup.label',
    },
    {
      accessorKey: 'emergencyContact',
      header: 'config.form.emergencyContact.label',
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
      accessorKey: 'status',
      header: 'config.form.status.label',
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
      key: 'gender',
      title: 'config.form.gender.label',
      options: [
        { label: 'config.form.gender.options.male', value: 'male' },
        { label: 'config.form.gender.options.female', value: 'female' },
      ],
    },
    {
      key: 'status',
      title: 'config.form.status.label',
      options: [
        { label: 'config.form.status.options.pending', value: 'pending' },
        { label: 'config.form.status.options.approved', value: 'approved' },
        { label: 'config.form.status.options.rejected', value: 'rejected' },
      ],
    },
    {
      key: 'enabled',
      title: 'config.form.enabled.label',
      options: [
        { label: 'config.form.enabled.options.Active', value: 'Active' },
        { label: 'config.form.enabled.options.Inactive', value: 'Inactive' },
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
      label: 'config.form.patientCode.label',
      name: 'patientCode',
      required: true,
      type: 'text',
      validation: {
        required: 'config.form.patientCode.validation.required',
        maxLength: { value: 255, message: 'config.form.patientCode.validation.maxLength' },
      },
    },
    {
      label: 'config.form.firstName.label',
      name: 'firstName',
      required: true,
      type: 'text',
      validation: {
        required: 'config.form.firstName.validation.required',
        maxLength: { value: 255, message: 'config.form.firstName.validation.maxLength' },
      },
    },
    {
      label: 'config.form.lastName.label',
      name: 'lastName',
      required: false,
      type: 'text',
      validation: {
        maxLength: { value: 255, message: 'config.form.lastName.validation.maxLength' },
      },
    },
    {
      label: 'config.form.gender.label',
      name: 'gender',
      required: false,
      type: 'select',
      validation: {
        in: { value: ['male', 'female'], message: 'config.form.gender.validation.in' },
      },
      options: [
        {
          label: 'config.form.gender.options.male',
          value: 'male',
        },
        {
          label: 'config.form.gender.options.female',
          value: 'female',
        },
      ],
    },
    {
      label: 'config.form.dateOfBirth.label',
      name: 'dateOfBirth',
      required: false,
      type: 'text',
      validation: {
        maxLength: { value: 255, message: 'config.form.dateOfBirth.validation.maxLength' },
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
      label: 'config.form.address.label',
      name: 'address',
      required: false,
      type: 'text',
      validation: {
        maxLength: { value: 255, message: 'config.form.address.validation.maxLength' },
      },
    },
    {
      label: 'config.form.bloodGroup.label',
      name: 'bloodGroup',
      required: false,
      type: 'text',
      validation: {
        maxLength: { value: 255, message: 'config.form.bloodGroup.validation.maxLength' },
      },
    },
    {
      label: 'config.form.emergencyContact.label',
      name: 'emergencyContact',
      required: false,
      type: 'text',
      validation: {
        maxLength: { value: 255, message: 'config.form.emergencyContact.validation.maxLength' },
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
      label: 'config.form.status.label',
      name: 'status',
      required: false,
      type: 'select',
      validation: {
        in: {
          value: ['pending', 'approved', 'rejected'],
          message: 'config.form.status.validation.in',
        },
      },
      options: [
        {
          label: 'config.form.status.options.pending',
          value: 'pending',
        },
        {
          label: 'config.form.status.options.approved',
          value: 'approved',
        },
        {
          label: 'config.form.status.options.rejected',
          value: 'rejected',
        },
      ],
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
      label: 'config.form.invoices.label',
      name: 'invoices',
      required: false,
      type: 'multiselect',
    },
  ],
  queryKey: 'patients',
  searchFields: [
    { label: 'config.form.patientCode.label', value: 'patientCode' },
    { label: 'config.form.firstName.label', value: 'firstName' },
    { label: 'config.form.lastName.label', value: 'lastName' },
    { label: 'config.form.contactNumber.label', value: 'contactNumber' },
    { label: 'config.form.email.label', value: 'email' },
    { label: 'config.form.address.label', value: 'address' },
    { label: 'config.form.bloodGroup.label', value: 'bloodGroup' },
    { label: 'config.form.emergencyContact.label', value: 'emergencyContact' },
  ],
  singleQueryKey: 'patient',
  title: 'config.title',
  sortableColumns: ['id', 'patientCode', 'firstName', 'createdAt'],
  relations: [],
  permissions: {
    view: 'dental-management.patients.view',
    create: 'dental-management.patients.create',
    update: 'dental-management.patients.update',
    delete: 'dental-management.patients.delete',
    bulkDelete: 'dental-management.patients.bulk-delete',
  },
};
