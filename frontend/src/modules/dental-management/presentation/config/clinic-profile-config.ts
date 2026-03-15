import { type EntityModuleConfig } from '@/types/EntityModuleConfig';

export const clinicProfileConfig: EntityModuleConfig = {
  columns: [],
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
      label: 'config.form.logoPath.label',
      name: 'logoPath',
      required: false,
      type: 'file',
      validation: {
        maxSize: { value: 5120, message: 'config.form.logoPath.validation.maxSize' },
        mimes: { value: ['jpg', 'jpeg', 'png'], message: 'config.form.logoPath.validation.mimes' },
      },
    },
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
      label: 'config.form.ownerName.label',
      name: 'ownerName',
      required: true,
      type: 'text',
      validation: {
        required: 'config.form.ownerName.validation.required',
        maxLength: { value: 255, message: 'config.form.ownerName.validation.maxLength' },
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
      label: 'config.form.contactNumber.label',
      name: 'contactNumber',
      required: false,
      type: 'phone',
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
        maxLength: { value: 255, message: 'config.form.email.validation.maxLength' },
        pattern: {
          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          message: 'config.form.email.validation.email',
        },
      },
    },
    {
      label: 'config.form.website.label',
      name: 'website',
      required: false,
      type: 'text',
      validation: {
        maxLength: { value: 255, message: 'config.form.website.validation.maxLength' },
      },
    },
    {
      label: 'config.form.licenseNumber.label',
      name: 'licenseNumber',
      required: false,
      type: 'text',
      validation: {
        maxLength: { value: 255, message: 'config.form.licenseNumber.validation.maxLength' },
      },
    },
    {
      label: 'config.form.notes.label',
      name: 'notes',
      required: false,
      type: 'textarea',
      validation: {
        maxLength: { value: 1000, message: 'config.form.notes.validation.maxLength' },
      },
    },
  ],
  queryKey: 'clinicProfile',
  relations: [],
  searchFields: [],
  singleQueryKey: 'clinicProfile',
  sortableColumns: [],
  title: 'config.title',
  permissions: {
    view: 'dental-management.clinic-profile.view',
    create: 'dental-management.clinic-profile.create',
    update: 'dental-management.clinic-profile.update',
    delete: 'dental-management.clinic-profile.delete',
    bulkDelete: 'dental-management.clinic-profile.bulk-delete',
  },
};
