import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Invoice } from '../entities/Invoice';

export type InvoiceRepositoryInterface = {
  createInvoice: (
    invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<ApiResponse<Invoice>>;
  getInvoice: (id: string | number) => Promise<ApiResponse<Invoice>>;
  updateInvoice: (
    id: string | number,
    invoice: Partial<Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<ApiResponse<Invoice>>;
  deleteInvoice: (id: string | number) => Promise<ApiResponse<null>>;
  paginate: (
    search?: string,
    searchFields?: string[],
    relations?: string[],
    filters?: Record<string, string[]>,
    page?: number,
    perPage?: number
  ) => Promise<ApiResponse<PaginatedApiResponse<Invoice[]>>>;
};
