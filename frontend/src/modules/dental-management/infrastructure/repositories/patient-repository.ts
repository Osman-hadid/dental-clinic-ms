import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Patient } from '../../domain/entities/Patient';
import { type PatientRepositoryInterface } from '../../domain/interfaces/PatientRepositoryInterface';

export class PatientRepository implements PatientRepositoryInterface {
  private readonly client: AxiosClient;

  constructor() {
    this.client = new AxiosClient();
  }

  private async fetchCsrf(): Promise<void> {
    await this.client.get('/sanctum/csrf-cookie');
  }

  async createPatient(
    patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Patient>> {
    try {
      await this.fetchCsrf();
      return await this.client.post<Patient>('/api/v1/dental-management/patients', patient);
    } catch (error: unknown) {
      return this.handleError<Patient>(error, 'PATIENT_CREATE_ERROR', 'Failed to create patient');
    }
  }

  async getPatient(id: string | number): Promise<ApiResponse<Patient>> {
    try {
      return await this.client.get<Patient>(`/api/v1/dental-management/patients/${id}`);
    } catch (error: unknown) {
      return this.handleError<Patient>(error, 'PATIENT_FETCH_ERROR', 'Failed to fetch patient');
    }
  }

  async updatePatient(
    id: string | number,
    patient: Partial<Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Patient>> {
    try {
      await this.fetchCsrf();
      const payload = { ...patient };
      return await this.client.put<Patient>(`/api/v1/dental-management/patients/${id}`, payload);
    } catch (error: unknown) {
      return this.handleError<Patient>(error, 'PATIENT_UPDATE_ERROR', 'Failed to update patient');
    }
  }

  async deletePatient(id: string | number): Promise<ApiResponse<null>> {
    try {
      await this.fetchCsrf();
      return await this.client.delete<null>(`/api/v1/dental-management/patients/${id}`);
    } catch (error: unknown) {
      return this.handleError<null>(error, 'PATIENT_DELETE_ERROR', 'Failed to delete patient');
    }
  }

  async paginate(
    search = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page = 1,
    perPage = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Patient[]>>> {
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

      return await this.client.get<PaginatedApiResponse<Patient[]>>(
        `/api/v1/dental-management/patients`,
        {
          params: parameters,
        }
      );
    } catch (error: unknown) {
      return this.handleError<PaginatedApiResponse<Patient[]>>(
        error,
        'PATIENT_LIST_ERROR',
        'Failed to fetch patients'
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
