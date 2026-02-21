import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Tooth } from '../entities/Tooth';

export type ToothRepositoryInterface = {
  createTooth: (
    tooth: Omit<Tooth, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<ApiResponse<Tooth>>;
  getTooth: (id: string | number) => Promise<ApiResponse<Tooth>>;
  updateTooth: (
    id: string | number,
    tooth: Partial<Omit<Tooth, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<ApiResponse<Tooth>>;
  deleteTooth: (id: string | number) => Promise<ApiResponse<null>>;
  paginate: (
    search?: string,
    searchFields?: string[],
    relations?: string[],
    filters?: Record<string, string[]>,
    page?: number,
    perPage?: number
  ) => Promise<ApiResponse<PaginatedApiResponse<Tooth[]>>>;
};
