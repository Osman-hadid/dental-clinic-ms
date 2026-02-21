import { type TreatmentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/TreatmentRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class DeleteTreatmentUseCase {
  constructor(private readonly treatmentRepository: TreatmentRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<null>> {
    return await this.treatmentRepository.deleteTreatment(id);
  }
}
