import { type Staff } from '@/modules/dental-management/domain/entities/Staff';
import { type StaffRepositoryInterface } from '@/modules/dental-management/domain/interfaces/StaffRepositoryInterface';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';

export class ListStaffUseCase {
  constructor(private readonly staffRepository: StaffRepositoryInterface) {}

  async execute(
    search: string = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page: number = 1,
    perPage: number = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Staff[]>>> {
    const relationsArray = Array.isArray(relations) ? relations : [];
    return this.staffRepository.paginate(
      search,
      searchFields,
      relationsArray,
      filters,
      page,
      perPage
    );
  }
}
