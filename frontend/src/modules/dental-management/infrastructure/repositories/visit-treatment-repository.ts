import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type VisitTreatment } from '../../domain/entities/VisitTreatment';
import { type VisitTreatmentRepositoryInterface } from '../../domain/interfaces/VisitTreatmentRepositoryInterface';

export class VisitTreatmentRepository implements VisitTreatmentRepositoryInterface {
  private readonly client: AxiosClient;

  constructor() {
    this.client = new AxiosClient();
  }

  private async fetchCsrf(): Promise<void> {
    await this.client.get('/sanctum/csrf-cookie');
  }

  async createVisitTreatment(
    visitTreatment: Omit<VisitTreatment, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<VisitTreatment>> {
    try {
      await this.fetchCsrf();
      return await this.client.post<VisitTreatment>(
        '/api/v1/dental-management/visit-treatments',
        visitTreatment
      );
    } catch (error: unknown) {
      return this.handleError<VisitTreatment>(
        error,
        'VISIT_TREATMENT_CREATE_ERROR',
        'Failed to create visitTreatment'
      );
    }
  }

  async getVisitTreatment(id: string | number): Promise<ApiResponse<VisitTreatment>> {
    try {
      return await this.client.get<VisitTreatment>(
        `/api/v1/dental-management/visit-treatments/${id}`
      );
    } catch (error: unknown) {
      return this.handleError<VisitTreatment>(
        error,
        'VISIT_TREATMENT_FETCH_ERROR',
        'Failed to fetch visitTreatment'
      );
    }
  }

  async updateVisitTreatment(
    id: string | number,
    visitTreatment: Partial<Omit<VisitTreatment, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<VisitTreatment>> {
    try {
      await this.fetchCsrf();
      const payload = { ...visitTreatment };
      return await this.client.put<VisitTreatment>(
        `/api/v1/dental-management/visit-treatments/${id}`,
        payload
      );
    } catch (error: unknown) {
      return this.handleError<VisitTreatment>(
        error,
        'VISIT_TREATMENT_UPDATE_ERROR',
        'Failed to update visitTreatment'
      );
    }
  }

  async deleteVisitTreatment(id: string | number): Promise<ApiResponse<null>> {
    try {
      await this.fetchCsrf();
      return await this.client.delete<null>(`/api/v1/dental-management/visit-treatments/${id}`);
    } catch (error: unknown) {
      return this.handleError<null>(
        error,
        'VISIT_TREATMENT_DELETE_ERROR',
        'Failed to delete visitTreatment'
      );
    }
  }

  async paginate(
    search = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page = 1,
    perPage = 10
  ): Promise<ApiResponse<PaginatedApiResponse<VisitTreatment[]>>> {
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

      return await this.client.get<PaginatedApiResponse<VisitTreatment[]>>(
        `/api/v1/dental-management/visit-treatments`,
        {
          params: parameters,
        }
      );
    } catch (error: unknown) {
      return this.handleError<PaginatedApiResponse<VisitTreatment[]>>(
        error,
        'VISIT_TREATMENT_LIST_ERROR',
        'Failed to fetch visitTreatments'
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
