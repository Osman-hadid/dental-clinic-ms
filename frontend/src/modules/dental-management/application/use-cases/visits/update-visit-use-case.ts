import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import { type VisitRepositoryInterface } from '@/modules/dental-management/domain/interfaces/VisitRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class UpdateVisitUseCase {
  constructor(private readonly visitRepository: VisitRepositoryInterface) {}

  async execute(
    id: string | number,
    visit: Partial<Omit<Visit, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Visit>> {
    return await this.visitRepository.updateVisit(id, visit);
  }
}
