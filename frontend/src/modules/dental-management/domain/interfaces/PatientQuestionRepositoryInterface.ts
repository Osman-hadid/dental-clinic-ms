import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type PatientQuestion } from '../entities/PatientQuestion';

export type PatientQuestionRepositoryInterface = {
  createPatientQuestion: (
    patientQuestion: Omit<PatientQuestion, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  ) => Promise<ApiResponse<PatientQuestion>>;
  updatePatientQuestion: (
    id: string | number,
    patientQuestion: Partial<Omit<PatientQuestion, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>
  ) => Promise<ApiResponse<PatientQuestion>>;
  deletePatientQuestion: (id: string | number) => Promise<ApiResponse<null>>;
  paginate: (
    search?: string,
    searchFields?: string[],
    relations?: string[],
    filters?: Record<string, string[]>,
    page?: number,
    perPage?: number
  ) => Promise<ApiResponse<PaginatedApiResponse<PatientQuestion[]>>>;
};
