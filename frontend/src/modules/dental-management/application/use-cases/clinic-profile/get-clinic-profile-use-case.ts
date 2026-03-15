import { type ClinicProfileRepositoryInterface } from '@/modules/dental-management/domain/interfaces/ClinicProfileRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';
import { type ClinicProfile } from '@/modules/dental-management/domain/entities/ClinicProfile';

export class GetClinicProfileUseCase {
  constructor(private readonly repository: ClinicProfileRepositoryInterface) {}

  async execute(): Promise<ApiResponse<ClinicProfile | null>> {
    return this.repository.getClinicProfile();
  }
}
