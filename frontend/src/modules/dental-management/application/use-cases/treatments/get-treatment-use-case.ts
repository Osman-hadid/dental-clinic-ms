import { type Treatment } from '@/modules/dental-management/domain/entities/Treatment';
import { type TreatmentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/TreatmentRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class GetTreatmentUseCase {
  constructor(private readonly treatmentRepository: TreatmentRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<Treatment>> {
    return this.treatmentRepository.getTreatment(id);
  }
}
