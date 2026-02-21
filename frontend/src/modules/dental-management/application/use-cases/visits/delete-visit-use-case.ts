import { type VisitRepositoryInterface } from '@/modules/dental-management/domain/interfaces/VisitRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class DeleteVisitUseCase {
  constructor(private readonly visitRepository: VisitRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<null>> {
    return await this.visitRepository.deleteVisit(id);
  }
}
