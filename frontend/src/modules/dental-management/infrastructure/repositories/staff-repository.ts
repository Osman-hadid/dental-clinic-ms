import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Staff } from '../../domain/entities/Staff';
import { type StaffRepositoryInterface } from '../../domain/interfaces/StaffRepositoryInterface';

export class StaffRepository implements StaffRepositoryInterface {
  private readonly client: AxiosClient;

  constructor() {
    this.client = new AxiosClient();
  }

  private async fetchCsrf(): Promise<void> {
    await this.client.get('/sanctum/csrf-cookie');
  }

  async createStaff(
    staff: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Staff>> {
    try {
      await this.fetchCsrf();
      return await this.client.post<Staff>('/api/v1/dental-management/staff', staff);
    } catch (error: unknown) {
      return this.handleError<Staff>(error, 'STAFF_CREATE_ERROR', 'Failed to create staff');
    }
  }

  async getStaff(id: string | number): Promise<ApiResponse<Staff>> {
    try {
      return await this.client.get<Staff>(`/api/v1/dental-management/staff/${id}`);
    } catch (error: unknown) {
      return this.handleError<Staff>(error, 'STAFF_FETCH_ERROR', 'Failed to fetch staff');
    }
  }

  async updateStaff(
    id: string | number,
    staff: Partial<Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Staff>> {
    try {
      await this.fetchCsrf();
      const payload = { ...staff };
      return await this.client.put<Staff>(`/api/v1/dental-management/staff/${id}`, payload);
    } catch (error: unknown) {
      return this.handleError<Staff>(error, 'STAFF_UPDATE_ERROR', 'Failed to update staff');
    }
  }

  async deleteStaff(id: string | number): Promise<ApiResponse<null>> {
    try {
      await this.fetchCsrf();
      return await this.client.delete<null>(`/api/v1/dental-management/staff/${id}`);
    } catch (error: unknown) {
      return this.handleError<null>(error, 'STAFF_DELETE_ERROR', 'Failed to delete staff');
    }
  }

  async paginate(
    search = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page = 1,
    perPage = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Staff[]>>> {
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

      return await this.client.get<PaginatedApiResponse<Staff[]>>(
        `/api/v1/dental-management/staff`,
        {
          params: parameters,
        }
      );
    } catch (error: unknown) {
      return this.handleError<PaginatedApiResponse<Staff[]>>(
        error,
        'STAFF_LIST_ERROR',
        'Failed to fetch staff'
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
