import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Treatment } from '../../domain/entities/Treatment';
import { type TreatmentRepositoryInterface } from '../../domain/interfaces/TreatmentRepositoryInterface';

export class TreatmentRepository implements TreatmentRepositoryInterface {
  private readonly client: AxiosClient;

  constructor() {
    this.client = new AxiosClient();
  }

  private async fetchCsrf(): Promise<void> {
    await this.client.get('/sanctum/csrf-cookie');
  }

  async createTreatment(
    treatment: Omit<Treatment, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Treatment>> {
    try {
      await this.fetchCsrf();
      return await this.client.post<Treatment>('/api/v1/dental-management/treatments', treatment);
    } catch (error: unknown) {
      return this.handleError<Treatment>(
        error,
        'TREATMENT_CREATE_ERROR',
        'Failed to create treatment'
      );
    }
  }

  async getTreatment(id: string | number): Promise<ApiResponse<Treatment>> {
    try {
      return await this.client.get<Treatment>(`/api/v1/dental-management/treatments/${id}`);
    } catch (error: unknown) {
      return this.handleError<Treatment>(
        error,
        'TREATMENT_FETCH_ERROR',
        'Failed to fetch treatment'
      );
    }
  }

  async updateTreatment(
    id: string | number,
    treatment: Partial<Omit<Treatment, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Treatment>> {
    try {
      await this.fetchCsrf();
      const payload = { ...treatment };
      return await this.client.put<Treatment>(
        `/api/v1/dental-management/treatments/${id}`,
        payload
      );
    } catch (error: unknown) {
      return this.handleError<Treatment>(
        error,
        'TREATMENT_UPDATE_ERROR',
        'Failed to update treatment'
      );
    }
  }

  async deleteTreatment(id: string | number): Promise<ApiResponse<null>> {
    try {
      await this.fetchCsrf();
      return await this.client.delete<null>(`/api/v1/dental-management/treatments/${id}`);
    } catch (error: unknown) {
      return this.handleError<null>(error, 'TREATMENT_DELETE_ERROR', 'Failed to delete treatment');
    }
  }

  async paginate(
    search = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page = 1,
    perPage = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Treatment[]>>> {
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

      return await this.client.get<PaginatedApiResponse<Treatment[]>>(
        `/api/v1/dental-management/treatments`,
        {
          params: parameters,
        }
      );
    } catch (error: unknown) {
      return this.handleError<PaginatedApiResponse<Treatment[]>>(
        error,
        'TREATMENT_LIST_ERROR',
        'Failed to fetch treatments'
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
