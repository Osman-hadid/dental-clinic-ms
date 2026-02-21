import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import { type VisitRepositoryInterface } from '@/modules/dental-management/domain/interfaces/VisitRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class GetVisitUseCase {
  constructor(private readonly visitRepository: VisitRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<Visit>> {
    return this.visitRepository.getVisit(id);
  }
}
