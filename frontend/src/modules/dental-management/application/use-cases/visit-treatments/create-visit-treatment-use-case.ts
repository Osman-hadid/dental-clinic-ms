import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import { type VisitTreatmentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/VisitTreatmentRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class CreateVisitTreatmentUseCase {
  constructor(private readonly visitTreatmentRepository: VisitTreatmentRepositoryInterface) {}

  async execute(
    visitTreatment: Omit<VisitTreatment, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<VisitTreatment>> {
    return await this.visitTreatmentRepository.createVisitTreatment(visitTreatment);
  }
}
