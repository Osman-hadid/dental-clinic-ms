import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type ApiResponse } from '@/types/ApiResponse';
import { type ClinicProfile } from '../../domain/entities/ClinicProfile';
import { type ClinicProfileRepositoryInterface } from '../../domain/interfaces/ClinicProfileRepositoryInterface';

export class ClinicProfileRepository implements ClinicProfileRepositoryInterface {
  private readonly client: AxiosClient;

  constructor() {
    this.client = new AxiosClient();
  }

  private async fetchCsrf(): Promise<void> {
    await this.client.get('/sanctum/csrf-cookie');
  }

  async getClinicProfile(): Promise<ApiResponse<ClinicProfile | null>> {
    try {
      return await this.client.get<ClinicProfile | null>('/api/v1/dental-management/clinic-profile');
    } catch (error: unknown) {
      return this.handleError<ClinicProfile | null>(
        error,
        'CLINIC_PROFILE_FETCH_ERROR',
        'Failed to fetch clinic profile'
      );
    }
  }

  async updateClinicProfile(
    profile: Partial<ClinicProfile> & { logoPath?: File | string | null }
  ): Promise<ApiResponse<ClinicProfile>> {
    try {
      await this.fetchCsrf();
      const hasFile = this.hasNewFile(profile);
      if (hasFile) {
        const formData = this.buildFormData(profile);
        formData.append('_method', 'PUT');
        return await this.client.post<ClinicProfile>(
          '/api/v1/dental-management/clinic-profile',
          formData,
          { headers: { 'Content-Type': undefined } }
        );
      }

      const payload = this.buildJson(profile);
      return await this.client.put<ClinicProfile>(
        '/api/v1/dental-management/clinic-profile',
        payload
      );
    } catch (error: unknown) {
      return this.handleError<ClinicProfile>(
        error,
        'CLINIC_PROFILE_UPDATE_ERROR',
        'Failed to update clinic profile'
      );
    }
  }

  private hasNewFile(data: Record<string, any>): boolean {
    const value = data.logoPath;
    return value instanceof File && value.size > 0 && value.lastModified > 0;
  }

  private shouldAppendNewFile(value: any): boolean {
    return value instanceof File && value.size > 0 && value.lastModified > 0;
  }

  private shouldSkipHttpString(value: any): boolean {
    return typeof value === 'string' && value.startsWith('http');
  }

  private shouldSkipMockFile(value: any): boolean {
    return value instanceof File && value.size === 0;
  }

  private buildFormData(data: Record<string, any>): FormData {
    const formData = new FormData();

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;

      if (this.shouldAppendNewFile(value)) {
        formData.append(key, value);
        continue;
      }

      if (value === null) {
        formData.append(key, '');
        continue;
      }

      if (this.shouldSkipHttpString(value)) {
        continue;
      }

      if (this.shouldSkipMockFile(value)) {
        continue;
      }

      if (value !== null) {
        formData.append(key, String(value));
      }
    }

    return formData;
  }

  private buildJson(data: Record<string, any>): Record<string, any> {
    const cleanedData: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      if (key === 'logoPath') {
        if (value === null || value === '') {
          cleanedData[key] = '';
          continue;
        }

        if (this.shouldSkipHttpString(value) || value instanceof File) {
          continue;
        }

        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        cleanedData[key] = value;
      }
    }

    return cleanedData;
  }

  // NOTE: updateClinicProfile handles multipart vs JSON to support Laravel's PUT+file parsing.

  private handleError<T>(error: unknown, code: string, defaultMessage: string): ApiResponse<T> {
    const responseError =
      error instanceof Error && 'response' in error ? (error as any).response : null;
    const errorData = responseError?.data?.error ?? responseError?.data;

    return {
      data: null,
      error: {
        code,
        details: errorData?.details ?? null,
        message: errorData?.message ?? defaultMessage,
      },
      message: errorData?.message ?? defaultMessage,
      success: false,
    };
  }
}
