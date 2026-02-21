import { type Module } from '@/modules/settings/domain/entities/Module';
import { type ModuleRepositoryInterface } from '@/modules/settings/domain/interfaces/ModuleRepositoryInterface';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';

export class ListModulesUseCase {
  constructor(private readonly moduleRepository: ModuleRepositoryInterface) {}

  async execute(
    search: string = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page: number = 1,
    perPage: number = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Module[]>>> {
    const relationsArray = Array.isArray(relations) ? relations : [];
    return this.moduleRepository.paginate(
      search,
      searchFields,
      relationsArray,
      filters,
      page,
      perPage
    );
  }
}
