export type TableColumn = {
  accessorKey: string | number;
  header: string;
  cell?: (row: any) => React.ReactNode;
  meta?: { hidden: boolean };
};

export type FormFieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'checkbox'
  | 'select'
  | 'textarea'
  | 'datetime-local'
  | 'multiselect'
  | 'file'
  | 'switch'
  | 'date'
  | 'phone'
  | 'custom';

export type FormFieldOption = {
  label: string;
  value: string;
  disabled?: boolean;
  description?: string;
  group?: string;
  icon?: React.ComponentType<{ className?: string }>;
};

export type FormFieldValidation = {
  required?: string;
  pattern?: { value: RegExp; message: string };
  in?: { value: string[]; message: string };
  mimes?: { value: string[]; message: string };
  maxLength?: { value: number; message: string };
  minLength?: { value: number; message: string };
  maxSize?: { value: number; message: string };
};

export type FormField = {
  name: string;
  label: string;
  type?: FormFieldType;
  required?: boolean;
  disabled?: boolean;
  options?: FormFieldOption[];
  validation?: FormFieldValidation;
  render?: (props: {
    value: any;
    onChange: (value: any) => void;
    defaultValues?: any;
  }) => React.ReactNode;
  relation?: string;
};

export type FilterOption = {
  label: string;
  value: string | number;
  disabled?: boolean;
  group?: string;
};

export type SearchField = {
  label: string;
  value: string;
};

export type OptionsSource =
  | { type: 'static'; options: FilterOption[] }
  | { type: 'enum'; values: string[] }
  | { type: 'api'; url: string; labelKey: string; valueKey: string }
  | { type: 'relation'; relation: string; labelKey?: string; valueKey?: string };

export type FilterField = {
  key: string;
  title: string;
  options?: FilterOption[];
  optionsSource?: OptionsSource;
};

export type EntityPermissions = {
  view: string;
  create: string;
  update: string;
  delete: string;
  bulkDelete: string;
};

export type EntityModuleConfig = {
  title: string;
  entity: string;
  queryKey: string;
  singleQueryKey: string;
  columns: TableColumn[];
  formFields: FormField[];
  searchFields: SearchField[];
  sortableColumns?: string[];
  relations?: string[];
  filters?: FilterField[];
  createTitle: string;
  editTitle: string;
  createButton: string;
  editButton: string;
  createSubmitText: string;
  editSubmitText: string;
  permissions: EntityPermissions;

  useCreate?: () => { mutateAsync: (payload: any) => Promise<any> };
  useUpdate?: () => { mutateAsync: (payload: any) => Promise<any> };
  useDelete?: () => { mutateAsync: (id: number) => Promise<any> };
};
