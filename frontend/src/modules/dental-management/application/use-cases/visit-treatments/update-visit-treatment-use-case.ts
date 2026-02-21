import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import { type VisitTreatmentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/VisitTreatmentRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class UpdateVisitTreatmentUseCase {
  constructor(private readonly visitTreatmentRepository: VisitTreatmentRepositoryInterface) {}

  async execute(
    id: string | number,
    visitTreatment: Partial<Omit<VisitTreatment, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<VisitTreatment>> {
    return await this.visitTreatmentRepository.updateVisitTreatment(id, visitTreatment);
  }
}
