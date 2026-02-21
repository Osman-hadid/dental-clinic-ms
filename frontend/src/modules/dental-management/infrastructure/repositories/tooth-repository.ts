import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Tooth } from '../../domain/entities/Tooth';
import { type ToothRepositoryInterface } from '../../domain/interfaces/ToothRepositoryInterface';

export class ToothRepository implements ToothRepositoryInterface {
  private readonly client: AxiosClient;

  constructor() {
    this.client = new AxiosClient();
  }

  private async fetchCsrf(): Promise<void> {
    await this.client.get('/sanctum/csrf-cookie');
  }

  async createTooth(
    tooth: Omit<Tooth, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Tooth>> {
    try {
      await this.fetchCsrf();
      return await this.client.post<Tooth>('/api/v1/dental-management/teeth', tooth);
    } catch (error: unknown) {
      return this.handleError<Tooth>(error, 'TOOTH_CREATE_ERROR', 'Failed to create tooth');
    }
  }

  async getTooth(id: string | number): Promise<ApiResponse<Tooth>> {
    try {
      return await this.client.get<Tooth>(`/api/v1/dental-management/teeth/${id}`);
    } catch (error: unknown) {
      return this.handleError<Tooth>(error, 'TOOTH_FETCH_ERROR', 'Failed to fetch tooth');
    }
  }

  async updateTooth(
    id: string | number,
    tooth: Partial<Omit<Tooth, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Tooth>> {
    try {
      await this.fetchCsrf();
      const payload = { ...tooth };
      return await this.client.put<Tooth>(`/api/v1/dental-management/teeth/${id}`, payload);
    } catch (error: unknown) {
      return this.handleError<Tooth>(error, 'TOOTH_UPDATE_ERROR', 'Failed to update tooth');
    }
  }

  async deleteTooth(id: string | number): Promise<ApiResponse<null>> {
    try {
      await this.fetchCsrf();
      return await this.client.delete<null>(`/api/v1/dental-management/teeth/${id}`);
    } catch (error: unknown) {
      return this.handleError<null>(error, 'TOOTH_DELETE_ERROR', 'Failed to delete tooth');
    }
  }

  async paginate(
    search = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page = 1,
    perPage = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Tooth[]>>> {
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

      return await this.client.get<PaginatedApiResponse<Tooth[]>>(
        `/api/v1/dental-management/teeth`,
        {
          params: parameters,
        }
      );
    } catch (error: unknown) {
      return this.handleError<PaginatedApiResponse<Tooth[]>>(
        error,
        'TOOTH_LIST_ERROR',
        'Failed to fetch teeth'
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
