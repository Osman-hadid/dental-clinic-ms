import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Invoice } from '../../domain/entities/Invoice';
import { type InvoiceRepositoryInterface } from '../../domain/interfaces/InvoiceRepositoryInterface';

export class InvoiceRepository implements InvoiceRepositoryInterface {
  private readonly client: AxiosClient;

  constructor() {
    this.client = new AxiosClient();
  }

  private async fetchCsrf(): Promise<void> {
    await this.client.get('/sanctum/csrf-cookie');
  }

  async createInvoice(
    invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Invoice>> {
    try {
      await this.fetchCsrf();
      return await this.client.post<Invoice>('/api/v1/dental-management/invoices', invoice);
    } catch (error: unknown) {
      return this.handleError<Invoice>(error, 'INVOICE_CREATE_ERROR', 'Failed to create invoice');
    }
  }

  async getInvoice(id: string | number): Promise<ApiResponse<Invoice>> {
    try {
      return await this.client.get<Invoice>(`/api/v1/dental-management/invoices/${id}`);
    } catch (error: unknown) {
      return this.handleError<Invoice>(error, 'INVOICE_FETCH_ERROR', 'Failed to fetch invoice');
    }
  }

  async updateInvoice(
    id: string | number,
    invoice: Partial<Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Invoice>> {
    try {
      await this.fetchCsrf();
      const payload = { ...invoice };
      return await this.client.put<Invoice>(`/api/v1/dental-management/invoices/${id}`, payload);
    } catch (error: unknown) {
      return this.handleError<Invoice>(error, 'INVOICE_UPDATE_ERROR', 'Failed to update invoice');
    }
  }

  async deleteInvoice(id: string | number): Promise<ApiResponse<null>> {
    try {
      await this.fetchCsrf();
      return await this.client.delete<null>(`/api/v1/dental-management/invoices/${id}`);
    } catch (error: unknown) {
      return this.handleError<null>(error, 'INVOICE_DELETE_ERROR', 'Failed to delete invoice');
    }
  }

  async paginate(
    search = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page = 1,
    perPage = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Invoice[]>>> {
    try {
      const parameters = new URLSearchParams({
        page: String(page),
        perPage: String(perPage),
        ...(search && { search }),
      });

      for (const field of searchFields) {
        parameters.append('searchFields[]', field);
      }

      for (const relation of relations) {
        parameters.append('include[]', relation);
      }

      for (const [key, values] of Object.entries(filters)) {
        for (const value of values) {
          parameters.append(`filter[${key}][]`, value);
        }
      }

      return await this.client.get<PaginatedApiResponse<Invoice[]>>(
        `/api/v1/dental-management/invoices`,
        {
          params: parameters,
        }
      );
    } catch (error: unknown) {
      return this.handleError<PaginatedApiResponse<Invoice[]>>(
        error,
        'INVOICE_LIST_ERROR',
        'Failed to fetch invoices'
      );
    }
  }

  private handleError<T>(error: unknown, code: string, defaultMessage: string): ApiResponse<T> {
    const responseError =
      error instanceof Error && 'response' in error ? (error as any).response : null;
    const errorData = responseError?.data?.error ?? responseError?.data;

    return {
      data: null,
      error: {
        code: errorData?.code ?? code,
        details: errorData?.details ?? null,
        message: errorData?.message ?? (error instanceof Error ? error.message : defaultMessage),
      },
      message: errorData?.message ?? (error instanceof Error ? error.message : defaultMessage),
      success: false,
    };
  }
}
