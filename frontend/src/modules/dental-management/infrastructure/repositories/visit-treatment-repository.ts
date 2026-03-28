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

  private hasNewFiles(data: Record<string, unknown>): boolean {
    const images = data.treatmentImages;
    return Array.isArray(images) && images.some((item) => item instanceof File && item.size > 0);
  }

  private buildJsonPayload(data: Record<string, unknown>): Record<string, unknown> {
    const payload = { ...data };
    if (Array.isArray(payload.treatmentImages)) {
      const persistedImages = payload.treatmentImages.filter((item) => !(item instanceof File));
      if (persistedImages.length > 0) {
        payload.treatmentImages = persistedImages;
      } else {
        delete payload.treatmentImages;
      }
    }

    return payload;
  }

  private buildFormData(data: Record<string, unknown>): FormData {
    const formData = new FormData();

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;

      if (key === 'treatmentImages') {
        if (Array.isArray(value)) {
          value.forEach((item) => {
            if (item instanceof File && item.size > 0) {
              formData.append('treatmentImages[]', item);
            }
          });
        }
        continue;
      }

      if (key === 'materialItems' || key === 'prescription') {
        if (value === null) {
          formData.append(key, '');
        } else {
          formData.append(key, JSON.stringify(value));
        }
        continue;
      }

      if (value === null) {
        formData.append(key, '');
        continue;
      }

      if (Array.isArray(value) || typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
        continue;
      }

      formData.append(key, String(value));
    }

    return formData;
  }

  async createVisitTreatment(
    visitTreatment: Omit<VisitTreatment, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<VisitTreatment>> {
    try {
      await this.fetchCsrf();
      if (this.hasNewFiles(visitTreatment as Record<string, unknown>)) {
        const formData = this.buildFormData(visitTreatment as Record<string, unknown>);
        return await this.client.post<VisitTreatment>(
          '/api/v1/dental-management/visit-treatments',
          formData,
          { headers: { 'Content-Type': undefined } }
        );
      }

      return await this.client.post<VisitTreatment>(
        '/api/v1/dental-management/visit-treatments',
        this.buildJsonPayload(visitTreatment as Record<string, unknown>)
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
      if (this.hasNewFiles(visitTreatment as Record<string, unknown>)) {
        const formData = this.buildFormData(visitTreatment as Record<string, unknown>);
        formData.append('_method', 'PUT');
        return await this.client.post<VisitTreatment>(
          `/api/v1/dental-management/visit-treatments/${id}`,
          formData,
          { headers: { 'Content-Type': undefined } }
        );
      }

      const payload = { ...visitTreatment };
      return await this.client.put<VisitTreatment>(
        `/api/v1/dental-management/visit-treatments/${id}`,
        this.buildJsonPayload(payload as Record<string, unknown>)
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
