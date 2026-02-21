import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Payment } from '../../domain/entities/Payment';
import { type PaymentRepositoryInterface } from '../../domain/interfaces/PaymentRepositoryInterface';

export class PaymentRepository implements PaymentRepositoryInterface {
  private readonly client: AxiosClient;

  constructor() {
    this.client = new AxiosClient();
  }

  private async fetchCsrf(): Promise<void> {
    await this.client.get('/sanctum/csrf-cookie');
  }

  async createPayment(
    payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Payment>> {
    try {
      await this.fetchCsrf();
      return await this.client.post<Payment>('/api/v1/dental-management/payments', payment);
    } catch (error: unknown) {
      return this.handleError<Payment>(error, 'PAYMENT_CREATE_ERROR', 'Failed to create payment');
    }
  }

  async getPayment(id: string | number): Promise<ApiResponse<Payment>> {
    try {
      return await this.client.get<Payment>(`/api/v1/dental-management/payments/${id}`);
    } catch (error: unknown) {
      return this.handleError<Payment>(error, 'PAYMENT_FETCH_ERROR', 'Failed to fetch payment');
    }
  }

  async updatePayment(
    id: string | number,
    payment: Partial<Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Payment>> {
    try {
      await this.fetchCsrf();
      const payload = { ...payment };
      return await this.client.put<Payment>(`/api/v1/dental-management/payments/${id}`, payload);
    } catch (error: unknown) {
      return this.handleError<Payment>(error, 'PAYMENT_UPDATE_ERROR', 'Failed to update payment');
    }
  }

  async deletePayment(id: string | number): Promise<ApiResponse<null>> {
    try {
      await this.fetchCsrf();
      return await this.client.delete<null>(`/api/v1/dental-management/payments/${id}`);
    } catch (error: unknown) {
      return this.handleError<null>(error, 'PAYMENT_DELETE_ERROR', 'Failed to delete payment');
    }
  }

  async paginate(
    search = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page = 1,
    perPage = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Payment[]>>> {
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

      return await this.client.get<PaginatedApiResponse<Payment[]>>(
        `/api/v1/dental-management/payments`,
        {
          params: parameters,
        }
      );
    } catch (error: unknown) {
      return this.handleError<PaginatedApiResponse<Payment[]>>(
        error,
        'PAYMENT_LIST_ERROR',
        'Failed to fetch payments'
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
