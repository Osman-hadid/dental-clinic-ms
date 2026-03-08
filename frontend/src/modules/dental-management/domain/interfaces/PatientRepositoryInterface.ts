import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Patient } from '../entities/Patient';

export type PatientRepositoryInterface = {
  createPatient: (
    patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<ApiResponse<Patient>>;
  getPatient: (id: string | number, relations?: string[]) => Promise<ApiResponse<Patient>>;
  updatePatient: (
    id: string | number,
    patient: Partial<Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<ApiResponse<Patient>>;
  deletePatient: (id: string | number) => Promise<ApiResponse<null>>;
  paginate: (
    search?: string,
    searchFields?: string[],
    relations?: string[],
    filters?: Record<string, string[]>,
    page?: number,
    perPage?: number
  ) => Promise<ApiResponse<PaginatedApiResponse<Patient[]>>>;
};
