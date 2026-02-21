import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Staff } from '../entities/Staff';

export type StaffRepositoryInterface = {
  createStaff: (
    staff: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<ApiResponse<Staff>>;
  getStaff: (id: string | number) => Promise<ApiResponse<Staff>>;
  updateStaff: (
    id: string | number,
    staff: Partial<Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<ApiResponse<Staff>>;
  deleteStaff: (id: string | number) => Promise<ApiResponse<null>>;
  paginate: (
    search?: string,
    searchFields?: string[],
    relations?: string[],
    filters?: Record<string, string[]>,
    page?: number,
    perPage?: number
  ) => Promise<ApiResponse<PaginatedApiResponse<Staff[]>>>;
};
