import { type Tooth } from '@/modules/dental-management/domain/entities/Tooth';
import { type ToothRepositoryInterface } from '@/modules/dental-management/domain/interfaces/ToothRepositoryInterface';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';

export class ListTeethUseCase {
  constructor(private readonly toothRepository: ToothRepositoryInterface) {}

  async execute(
    search: string = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page: number = 1,
    perPage: number = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Tooth[]>>> {
    const relationsArray = Array.isArray(relations) ? relations : [];
    return this.toothRepository.paginate(
      search,
      searchFields,
      relationsArray,
      filters,
      page,
      perPage
    );
  }
}
