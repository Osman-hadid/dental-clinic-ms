import { type VisitTreatmentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/VisitTreatmentRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class DeleteVisitTreatmentUseCase {
  constructor(private readonly visitTreatmentRepository: VisitTreatmentRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<null>> {
    return await this.visitTreatmentRepository.deleteVisitTreatment(id);
  }
}
