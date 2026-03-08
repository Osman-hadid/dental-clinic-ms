import { ListPatientQuestionsUseCase } from '@/modules/dental-management/application/use-cases/patient-questions/list-patient-questions-use-case';
import { type PatientQuestion } from '@/modules/dental-management/domain/entities/PatientQuestion';
import { PatientQuestionRepository } from '@/modules/dental-management/infrastructure/repositories/patient-question-repository';
import {
  type ApiErrorDetail,
  type ApiResponse,
  type PaginatedApiResponse,
  type PaginationLinks,
  type PaginationMeta,
} from '@/types/ApiResponse';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { patientQuestionConfig } from '../../config/patient-question-config';

export type PatientQuestionListResponse = {
  entities: PatientQuestion[];
  pagination?: PaginationMeta;
  links?: PaginationLinks;
  isFetching: boolean;
  error: ApiErrorDetail | null;
  message: string;
  refetch: () => Promise<void>;
};

export const usePatientQuestionList = (
  page: number = 1,
  perPage: number = 10,
  search: string = '',
  searchFields: string[] = patientQuestionConfig.searchFields?.map((field) => field.value) || [],
  relations: string[] = patientQuestionConfig.relations ?? [],
  filters: Record<string, string[]> = {}
): PatientQuestionListResponse => {
  const queryKey = [
    patientQuestionConfig.queryKey,
    page,
    perPage,
    search,
    searchFields.join(','),
    relations,
    JSON.stringify(filters),
  ] as const;

  const {
    data,
    error,
    isFetching,
    refetch: queryRefetch,
  } = useQuery<ApiResponse<PaginatedApiResponse<PatientQuestion[]>>>({
    gcTime: 10 * 60 * 1000,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const patientQuestionRepository = new PatientQuestionRepository();
      const listPatientQuestionsUseCase = new ListPatientQuestionsUseCase(
        patientQuestionRepository
      );
      const response = await listPatientQuestionsUseCase.execute(
        search,
        searchFields,
        relations,
        filters,
        page,
        perPage
      );
      if (response.error) {
        toast.error(response.error.message || 'Failed to fetch patient questions', {
          position: 'top-center',
        });
      }
      return response;
    },
    queryKey,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  return {
    entities: data?.data?.data ?? [],
    error: error
      ? {
          code: error.name || 'PATIENT_QUESTION_LIST_ERROR',
          details: null,
          message: error.message || 'Failed to fetch patient questions',
        }
      : (data?.error ?? null),
    isFetching,
    links: data?.data?.links,
    message: data?.message ?? error?.message ?? 'Patient questions fetched successfully',
    pagination: data?.data?.meta,
    refetch: async () => {
      await queryRefetch();
    },
  };
};
