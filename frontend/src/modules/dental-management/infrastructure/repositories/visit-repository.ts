import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Visit } from '../../domain/entities/Visit';
import { type VisitRepositoryInterface } from '../../domain/interfaces/VisitRepositoryInterface';

export class VisitRepository implements VisitRepositoryInterface {
  private readonly client: AxiosClient;

  constructor() {
    this.client = new AxiosClient();
  }

  private async fetchCsrf(): Promise<void> {
    await this.client.get('/sanctum/csrf-cookie');
  }

  async createVisit(
    visit: Omit<Visit, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Visit>> {
    try {
      await this.fetchCsrf();
      return await this.client.post<Visit>('/api/v1/dental-management/visits', visit);
    } catch (error: unknown) {
      return this.handleError<Visit>(error, 'VISIT_CREATE_ERROR', 'Failed to create visit');
    }
  }

  async getVisit(id: string | number): Promise<ApiResponse<Visit>> {
    try {
      return await this.client.get<Visit>(`/api/v1/dental-management/visits/${id}`);
    } catch (error: unknown) {
      return this.handleError<Visit>(error, 'VISIT_FETCH_ERROR', 'Failed to fetch visit');
    }
  }

  async updateVisit(
    id: string | number,
    visit: Partial<Omit<Visit, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Visit>> {
    try {
      await this.fetchCsrf();
      const payload = { ...visit };
      return await this.client.put<Visit>(`/api/v1/dental-management/visits/${id}`, payload);
    } catch (error: unknown) {
      return this.handleError<Visit>(error, 'VISIT_UPDATE_ERROR', 'Failed to update visit');
    }
  }

  async deleteVisit(id: string | number): Promise<ApiResponse<null>> {
    try {
      await this.fetchCsrf();
      return await this.client.delete<null>(`/api/v1/dental-management/visits/${id}`);
    } catch (error: unknown) {
      return this.handleError<null>(error, 'VISIT_DELETE_ERROR', 'Failed to delete visit');
    }
  }

  async paginate(
    search = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page = 1,
    perPage = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Visit[]>>> {
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

      return await this.client.get<PaginatedApiResponse<Visit[]>>(
        `/api/v1/dental-management/visits`,
        {
          params: parameters,
        }
      );
    } catch (error: unknown) {
      return this.handleError<PaginatedApiResponse<Visit[]>>(
        error,
        'VISIT_LIST_ERROR',
        'Failed to fetch visits'
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
