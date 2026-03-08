import { type EntityModuleConfig } from '@/types/EntityModuleConfig';
import { type PatientQuestion } from '../../domain/entities/PatientQuestion';

const answerTypeLabels: Record<PatientQuestion['answerType'], string> = {
  text: 'Text',
  textarea: 'Paragraph',
  number: 'Number',
  yes_no: 'Yes / No',
  date: 'Date',
};

export const patientQuestionConfig: EntityModuleConfig = {
  columns: [
    {
      accessorKey: 'questionText',
      header: 'config.form.questionText.label',
    },
    {
      accessorKey: 'answerType',
      header: 'config.form.answerType.label',
      cell: (question: PatientQuestion) =>
        answerTypeLabels[question.answerType] ?? question.answerType,
    },
    {
      accessorKey: 'isRequired',
      header: 'config.form.isRequired.label',
      cell: (question: PatientQuestion) => (question.isRequired ? 'Required' : 'Optional'),
    },
    {
      accessorKey: 'isActive',
      header: 'config.form.isActive.label',
      cell: (question: PatientQuestion) => (question.isActive ? 'Active' : 'Inactive'),
    },
    {
      accessorKey: 'sortOrder',
      header: 'config.form.sortOrder.label',
    },
    {
      accessorKey: 'helpText',
      header: 'config.form.helpText.label',
    },
  ],
  createButton: 'config.table.add',
  createSubmitText: 'config.table.create',
  createTitle: 'config.table.create',
  editButton: 'config.table.update',
  editSubmitText: 'config.table.update',
  editTitle: 'config.table.edit',
  entity: 'config.entity',
  filters: [
    {
      key: 'answerType',
      title: 'config.form.answerType.label',
      options: [
        { label: 'config.form.answerType.options.text', value: 'text' },
        { label: 'config.form.answerType.options.textarea', value: 'textarea' },
        { label: 'config.form.answerType.options.number', value: 'number' },
        { label: 'config.form.answerType.options.yes_no', value: 'yes_no' },
        { label: 'config.form.answerType.options.date', value: 'date' },
      ],
    },
    {
      key: 'isRequired',
      title: 'config.form.isRequired.label',
      options: [
        { label: 'config.form.isRequired.options.required', value: '1' },
        { label: 'config.form.isRequired.options.optional', value: '0' },
      ],
    },
    {
      key: 'isActive',
      title: 'config.form.isActive.label',
      options: [
        { label: 'config.form.isActive.options.active', value: '1' },
        { label: 'config.form.isActive.options.inactive', value: '0' },
      ],
    },
  ],
  formFields: [
    {
      label: 'config.form.questionText.label',
      name: 'questionText',
      required: true,
      type: 'textarea',
      validation: {
        required: 'config.form.questionText.validation.required',
        maxLength: { value: 5000, message: 'config.form.questionText.validation.maxLength' },
      },
    },
    {
      label: 'config.form.answerType.label',
      name: 'answerType',
      required: true,
      type: 'select',
      validation: {
        in: {
          value: ['text', 'textarea', 'number', 'yes_no', 'date'],
          message: 'config.form.answerType.validation.in',
        },
      },
      options: [
        { label: 'config.form.answerType.options.text', value: 'text' },
        { label: 'config.form.answerType.options.textarea', value: 'textarea' },
        { label: 'config.form.answerType.options.number', value: 'number' },
        { label: 'config.form.answerType.options.yes_no', value: 'yes_no' },
        { label: 'config.form.answerType.options.date', value: 'date' },
      ],
    },
    {
      label: 'config.form.helpText.label',
      name: 'helpText',
      required: false,
      type: 'textarea',
      validation: {
        maxLength: { value: 5000, message: 'config.form.helpText.validation.maxLength' },
      },
    },
    {
      label: 'config.form.sortOrder.label',
      name: 'sortOrder',
      required: false,
      type: 'number',
    },
    {
      label: 'config.form.isRequired.label',
      name: 'isRequired',
      required: false,
      type: 'checkbox',
    },
    {
      label: 'config.form.isActive.label',
      name: 'isActive',
      required: false,
      type: 'checkbox',
    },
  ],
  permissions: {
    view: 'dental-management.patient-questions.view',
    create: 'dental-management.patient-questions.create',
    update: 'dental-management.patient-questions.update',
    delete: 'dental-management.patient-questions.delete',
    bulkDelete: 'dental-management.patient-questions.bulk-delete',
  },
  queryKey: 'patientQuestions',
  relations: [],
  searchFields: [
    { label: 'config.form.questionText.label', value: 'questionText' },
    { label: 'config.form.helpText.label', value: 'helpText' },
  ],
  singleQueryKey: 'patientQuestion',
  sortableColumns: ['id', 'questionText', 'sortOrder', 'createdAt'],
  title: 'config.title',
};
