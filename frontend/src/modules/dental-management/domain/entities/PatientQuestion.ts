export type PatientQuestion = {
  id: number;
  questionText: string;
  answerType: 'text' | 'textarea' | 'number' | 'yes_no' | 'date';
  helpText?: string;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type PatientQuestionAnswer = {
  id?: number;
  questionId: number | string;
  answer?: string;
  question?: PatientQuestion;
  createdAt?: string;
  updatedAt?: string;
};
