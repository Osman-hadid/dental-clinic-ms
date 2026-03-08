import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type PatientQuestion } from '../../domain/entities/PatientQuestion';
import { type PatientQuestionRepositoryInterface } from '../../domain/interfaces/PatientQuestionRepositoryInterface';

export class PatientQuestionRepository implements PatientQuestionRepositoryInterface {
  private readonly client: AxiosClient;

  constructor() {
    this.client = new AxiosClient();
  }

  private async fetchCsrf(): Promise<void> {
    await this.client.get('/sanctum/csrf-cookie');
  }

  async createPatientQuestion(
    patientQuestion: Omit<PatientQuestion, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  ): Promise<ApiResponse<PatientQuestion>> {
    try {
      await this.fetchCsrf();
      return await this.client.post<PatientQuestion>(
        '/api/v1/dental-management/patient-questions',
        patientQuestion
      );
    } catch (error: unknown) {
      return this.handleError<PatientQuestion>(
        error,
        'PATIENT_QUESTION_CREATE_ERROR',
        'Failed to create patient question'
      );
    }
  }

  async updatePatientQuestion(
    id: string | number,
    patientQuestion: Partial<Omit<PatientQuestion, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>
  ): Promise<ApiResponse<PatientQuestion>> {
    try {
      await this.fetchCsrf();
      return await this.client.put<PatientQuestion>(
        `/api/v1/dental-management/patient-questions/${id}`,
        patientQuestion
      );
    } catch (error: unknown) {
      return this.handleError<PatientQuestion>(
        error,
        'PATIENT_QUESTION_UPDATE_ERROR',
        'Failed to update patient question'
      );
    }
  }

  async deletePatientQuestion(id: string | number): Promise<ApiResponse<null>> {
    try {
      await this.fetchCsrf();
      return await this.client.delete<null>(`/api/v1/dental-management/patient-questions/${id}`);
    } catch (error: unknown) {
      return this.handleError<null>(
        error,
        'PATIENT_QUESTION_DELETE_ERROR',
        'Failed to delete patient question'
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
  ): Promise<ApiResponse<PaginatedApiResponse<PatientQuestion[]>>> {
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

      return await this.client.get<PaginatedApiResponse<PatientQuestion[]>>(
        '/api/v1/dental-management/patient-questions',
        {
          params: parameters,
        }
      );
    } catch (error: unknown) {
      return this.handleError<PaginatedApiResponse<PatientQuestion[]>>(
        error,
        'PATIENT_QUESTION_LIST_ERROR',
        'Failed to fetch patient questions'
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
