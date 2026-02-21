import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Module } from '../../domain/entities/Module';
import { type ModuleRepositoryInterface } from '../../domain/interfaces/ModuleRepositoryInterface';

export class ModuleRepository implements ModuleRepositoryInterface {
  private readonly client: AxiosClient;

  constructor() {
    this.client = new AxiosClient();
  }

  private async fetchCsrf(): Promise<void> {
    await this.client.get('/sanctum/csrf-cookie');
  }

  async createModule(
    module: Omit<Module, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Module>> {
    try {
      await this.fetchCsrf();
      return await this.client.post<Module>('/api/v1/settings/modules', module);
    } catch (error: unknown) {
      return this.handleError<Module>(error, 'MODULE_CREATE_ERROR', 'Failed to create module');
    }
  }

  async getModule(id: string | number): Promise<ApiResponse<Module>> {
    try {
      return await this.client.get<Module>(`/api/v1/settings/modules/${id}`);
    } catch (error: unknown) {
      return this.handleError<Module>(error, 'MODULE_FETCH_ERROR', 'Failed to fetch module');
    }
  }

  async updateModule(
    id: string | number,
    module: Partial<Omit<Module, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Module>> {
    try {
      await this.fetchCsrf();
      const payload = { ...module };
      return await this.client.put<Module>(`/api/v1/settings/modules/${id}`, payload);
    } catch (error: unknown) {
      return this.handleError<Module>(error, 'MODULE_UPDATE_ERROR', 'Failed to update module');
    }
  }

  async deleteModule(id: string | number): Promise<ApiResponse<null>> {
    try {
      await this.fetchCsrf();
      return await this.client.delete<null>(`/api/v1/settings/modules/${id}`);
    } catch (error: unknown) {
      return this.handleError<null>(error, 'MODULE_DELETE_ERROR', 'Failed to delete module');
    }
  }

  async paginate(
    search = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page = 1,
    perPage = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Module[]>>> {
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

      return await this.client.get<PaginatedApiResponse<Module[]>>(`/api/v1/settings/modules`, {
        params: parameters,
      });
    } catch (error: unknown) {
      return this.handleError<PaginatedApiResponse<Module[]>>(
        error,
        'MODULE_LIST_ERROR',
        'Failed to fetch modules'
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
