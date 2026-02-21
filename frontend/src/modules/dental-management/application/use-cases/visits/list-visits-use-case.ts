import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import { type VisitRepositoryInterface } from '@/modules/dental-management/domain/interfaces/VisitRepositoryInterface';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';

export class ListVisitsUseCase {
  constructor(private readonly visitRepository: VisitRepositoryInterface) {}

  async execute(
    search: string = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page: number = 1,
    perPage: number = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Visit[]>>> {
    const relationsArray = Array.isArray(relations) ? relations : [];
    return this.visitRepository.paginate(
      search,
      searchFields,
      relationsArray,
      filters,
      page,
      perPage
    );
  }
}
