import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import { type VisitRepositoryInterface } from '@/modules/dental-management/domain/interfaces/VisitRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class CreateVisitUseCase {
  constructor(private readonly visitRepository: VisitRepositoryInterface) {}

  async execute(visit: Omit<Visit, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Visit>> {
    return await this.visitRepository.createVisit(visit);
  }
}
