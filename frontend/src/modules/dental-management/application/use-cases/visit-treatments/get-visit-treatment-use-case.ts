import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import { type VisitTreatmentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/VisitTreatmentRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class GetVisitTreatmentUseCase {
  constructor(private readonly visitTreatmentRepository: VisitTreatmentRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<VisitTreatment>> {
    return this.visitTreatmentRepository.getVisitTreatment(id);
  }
}
