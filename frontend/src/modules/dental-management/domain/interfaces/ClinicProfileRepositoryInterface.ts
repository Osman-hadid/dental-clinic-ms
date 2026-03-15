import { type ApiResponse } from '@/types/ApiResponse';
import { type ClinicProfile } from '../entities/ClinicProfile';

export interface ClinicProfileRepositoryInterface {
  getClinicProfile(): Promise<ApiResponse<ClinicProfile | null>>;
  updateClinicProfile(
    profile: Partial<ClinicProfile> & { logoPath?: File | string | null }
  ): Promise<ApiResponse<ClinicProfile>>;
}
