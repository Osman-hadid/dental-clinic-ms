import { type ClinicProfile } from '@/modules/dental-management/domain/entities/ClinicProfile';
import { type ClinicProfileRepositoryInterface } from '@/modules/dental-management/domain/interfaces/ClinicProfileRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class UpdateClinicProfileUseCase {
  constructor(private readonly repository: ClinicProfileRepositoryInterface) {}

  async execute(
    payload: Partial<ClinicProfile> & { logoPath?: File | string | null }
  ): Promise<ApiResponse<ClinicProfile>> {
    return this.repository.updateClinicProfile(payload);
  }
}
