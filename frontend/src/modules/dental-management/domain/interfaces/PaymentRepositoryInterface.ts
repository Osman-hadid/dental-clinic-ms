import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Payment } from '../entities/Payment';

export type PaymentRepositoryInterface = {
  createPayment: (
    payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<ApiResponse<Payment>>;
  getPayment: (id: string | number) => Promise<ApiResponse<Payment>>;
  updatePayment: (
    id: string | number,
    payment: Partial<Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<ApiResponse<Payment>>;
  deletePayment: (id: string | number) => Promise<ApiResponse<null>>;
  paginate: (
    search?: string,
    searchFields?: string[],
    relations?: string[],
    filters?: Record<string, string[]>,
    page?: number,
    perPage?: number
  ) => Promise<ApiResponse<PaginatedApiResponse<Payment[]>>>;
};
