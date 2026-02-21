import { type Treatment } from '@/modules/dental-management/domain/entities/Treatment';
import { type TreatmentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/TreatmentRepositoryInterface';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';

export class ListTreatmentsUseCase {
  constructor(private readonly treatmentRepository: TreatmentRepositoryInterface) {}

  async execute(
    search: string = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page: number = 1,
    perPage: number = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Treatment[]>>> {
    const relationsArray = Array.isArray(relations) ? relations : [];
    return this.treatmentRepository.paginate(
      search,
      searchFields,
      relationsArray,
      filters,
      page,
      perPage
    );
  }
}
