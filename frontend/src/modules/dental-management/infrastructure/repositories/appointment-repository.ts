import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Appointment } from '../../domain/entities/Appointment';
import { type AppointmentRepositoryInterface } from '../../domain/interfaces/AppointmentRepositoryInterface';

export class AppointmentRepository implements AppointmentRepositoryInterface {
  private readonly client: AxiosClient;

  constructor() {
    this.client = new AxiosClient();
  }

  private async fetchCsrf(): Promise<void> {
    await this.client.get('/sanctum/csrf-cookie');
  }

  async createAppointment(
    appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Appointment>> {
    try {
      await this.fetchCsrf();
      return await this.client.post<Appointment>(
        '/api/v1/dental-management/appointments',
        appointment
      );
    } catch (error: unknown) {
      return this.handleError<Appointment>(
        error,
        'APPOINTMENT_CREATE_ERROR',
        'Failed to create appointment'
      );
    }
  }

  async getAppointment(id: string | number): Promise<ApiResponse<Appointment>> {
    try {
      return await this.client.get<Appointment>(`/api/v1/dental-management/appointments/${id}`);
    } catch (error: unknown) {
      return this.handleError<Appointment>(
        error,
        'APPOINTMENT_FETCH_ERROR',
        'Failed to fetch appointment'
      );
    }
  }

  async updateAppointment(
    id: string | number,
    appointment: Partial<Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Appointment>> {
    try {
      await this.fetchCsrf();
      const payload = { ...appointment };
      return await this.client.put<Appointment>(
        `/api/v1/dental-management/appointments/${id}`,
        payload
      );
    } catch (error: unknown) {
      return this.handleError<Appointment>(
        error,
        'APPOINTMENT_UPDATE_ERROR',
        'Failed to update appointment'
      );
    }
  }

  async deleteAppointment(id: string | number): Promise<ApiResponse<null>> {
    try {
      await this.fetchCsrf();
      return await this.client.delete<null>(`/api/v1/dental-management/appointments/${id}`);
    } catch (error: unknown) {
      return this.handleError<null>(
        error,
        'APPOINTMENT_DELETE_ERROR',
        'Failed to delete appointment'
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
  ): Promise<ApiResponse<PaginatedApiResponse<Appointment[]>>> {
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

      return await this.client.get<PaginatedApiResponse<Appointment[]>>(
        `/api/v1/dental-management/appointments`,
        {
          params: parameters,
        }
      );
    } catch (error: unknown) {
      return this.handleError<PaginatedApiResponse<Appointment[]>>(
        error,
        'APPOINTMENT_LIST_ERROR',
        'Failed to fetch appointments'
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
