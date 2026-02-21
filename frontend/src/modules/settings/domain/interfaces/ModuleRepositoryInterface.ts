import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Module } from '../entities/Module';

export type ModuleRepositoryInterface = {
  createModule: (
    module: Omit<Module, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<ApiResponse<Module>>;
  getModule: (id: string | number) => Promise<ApiResponse<Module>>;
  updateModule: (
    id: string | number,
    module: Partial<Omit<Module, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<ApiResponse<Module>>;
  deleteModule: (id: string | number) => Promise<ApiResponse<null>>;
  paginate: (
    search?: string,
    searchFields?: string[],
    relations?: string[],
    filters?: Record<string, string[]>,
    page?: number,
    perPage?: number
  ) => Promise<ApiResponse<PaginatedApiResponse<Module[]>>>;
};
