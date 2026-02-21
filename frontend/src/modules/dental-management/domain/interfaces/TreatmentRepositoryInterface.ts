import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Treatment } from '../entities/Treatment';

export type TreatmentRepositoryInterface = {
  createTreatment: (
    treatment: Omit<Treatment, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<ApiResponse<Treatment>>;
  getTreatment: (id: string | number) => Promise<ApiResponse<Treatment>>;
  updateTreatment: (
    id: string | number,
    treatment: Partial<Omit<Treatment, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<ApiResponse<Treatment>>;
  deleteTreatment: (id: string | number) => Promise<ApiResponse<null>>;
  paginate: (
    search?: string,
    searchFields?: string[],
    relations?: string[],
    filters?: Record<string, string[]>,
    page?: number,
    perPage?: number
  ) => Promise<ApiResponse<PaginatedApiResponse<Treatment[]>>>;
};
