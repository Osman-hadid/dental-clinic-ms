import { type Patient } from '@/modules/dental-management/domain/entities/Patient';
import { type PatientRepositoryInterface } from '@/modules/dental-management/domain/interfaces/PatientRepositoryInterface';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';

export class ListPatientsUseCase {
  constructor(private readonly patientRepository: PatientRepositoryInterface) {}

  async execute(
    search: string = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page: number = 1,
    perPage: number = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Patient[]>>> {
    const relationsArray = Array.isArray(relations) ? relations : [];
    return this.patientRepository.paginate(
      search,
      searchFields,
      relationsArray,
      filters,
      page,
      perPage
    );
  }
}
