import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type VisitTreatment } from '../entities/VisitTreatment';

export type VisitTreatmentRepositoryInterface = {
  createVisitTreatment: (
    visitTreatment: Omit<VisitTreatment, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<ApiResponse<VisitTreatment>>;
  getVisitTreatment: (id: string | number) => Promise<ApiResponse<VisitTreatment>>;
  updateVisitTreatment: (
    id: string | number,
    visitTreatment: Partial<Omit<VisitTreatment, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<ApiResponse<VisitTreatment>>;
  deleteVisitTreatment: (id: string | number) => Promise<ApiResponse<null>>;
  paginate: (
    search?: string,
    searchFields?: string[],
    relations?: string[],
    filters?: Record<string, string[]>,
    page?: number,
    perPage?: number
  ) => Promise<ApiResponse<PaginatedApiResponse<VisitTreatment[]>>>;
};
