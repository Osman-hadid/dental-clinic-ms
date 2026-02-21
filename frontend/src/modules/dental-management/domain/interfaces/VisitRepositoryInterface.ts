import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Visit } from '../entities/Visit';

export type VisitRepositoryInterface = {
  createVisit: (
    visit: Omit<Visit, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<ApiResponse<Visit>>;
  getVisit: (id: string | number) => Promise<ApiResponse<Visit>>;
  updateVisit: (
    id: string | number,
    visit: Partial<Omit<Visit, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<ApiResponse<Visit>>;
  deleteVisit: (id: string | number) => Promise<ApiResponse<null>>;
  paginate: (
    search?: string,
    searchFields?: string[],
    relations?: string[],
    filters?: Record<string, string[]>,
    page?: number,
    perPage?: number
  ) => Promise<ApiResponse<PaginatedApiResponse<Visit[]>>>;
};
