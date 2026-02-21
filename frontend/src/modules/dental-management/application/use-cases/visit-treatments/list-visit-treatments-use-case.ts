import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import { type VisitTreatmentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/VisitTreatmentRepositoryInterface';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';

export class ListVisitTreatmentsUseCase {
  constructor(private readonly visitTreatmentRepository: VisitTreatmentRepositoryInterface) {}

  async execute(
    search: string = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page: number = 1,
    perPage: number = 10
  ): Promise<ApiResponse<PaginatedApiResponse<VisitTreatment[]>>> {
    const relationsArray = Array.isArray(relations) ? relations : [];
    return this.visitTreatmentRepository.paginate(
      search,
      searchFields,
      relationsArray,
      filters,
      page,
      perPage
    );
  }
}
