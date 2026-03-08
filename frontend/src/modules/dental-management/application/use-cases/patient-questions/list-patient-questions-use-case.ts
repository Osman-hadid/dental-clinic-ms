import { type PatientQuestion } from '@/modules/dental-management/domain/entities/PatientQuestion';
import { type PatientQuestionRepositoryInterface } from '@/modules/dental-management/domain/interfaces/PatientQuestionRepositoryInterface';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';

export class ListPatientQuestionsUseCase {
  constructor(private readonly patientQuestionRepository: PatientQuestionRepositoryInterface) {}

  async execute(
    search: string = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page: number = 1,
    perPage: number = 10
  ): Promise<ApiResponse<PaginatedApiResponse<PatientQuestion[]>>> {
    return this.patientQuestionRepository.paginate(
      search,
      searchFields,
      relations,
      filters,
      page,
      perPage
    );
  }
}
