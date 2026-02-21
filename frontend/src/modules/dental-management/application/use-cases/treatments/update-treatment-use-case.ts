import { type Treatment } from '@/modules/dental-management/domain/entities/Treatment';
import { type TreatmentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/TreatmentRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class UpdateTreatmentUseCase {
  constructor(private readonly treatmentRepository: TreatmentRepositoryInterface) {}

  async execute(
    id: string | number,
    treatment: Partial<Omit<Treatment, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Treatment>> {
    return await this.treatmentRepository.updateTreatment(id, treatment);
  }
}
