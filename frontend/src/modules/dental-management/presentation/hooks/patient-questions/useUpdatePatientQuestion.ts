import { UpdatePatientQuestionUseCase } from '@/modules/dental-management/application/use-cases/patient-questions/update-patient-question-use-case';
import { type PatientQuestion } from '@/modules/dental-management/domain/entities/PatientQuestion';
import { PatientQuestionRepository } from '@/modules/dental-management/infrastructure/repositories/patient-question-repository';
import { type ApiResponse } from '@/types/ApiResponse';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { patientQuestionConfig } from '../../config/patient-question-config';

type UpdatePatientQuestionVariables = {
  id: string | number;
  data: Partial<Omit<PatientQuestion, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>;
};

export const useUpdatePatientQuestion = (): UseMutationResult<
  ApiResponse<PatientQuestion>,
  Error,
  UpdatePatientQuestionVariables
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, id }) => {
      const patientQuestionRepository = new PatientQuestionRepository();
      const updatePatientQuestionUseCase = new UpdatePatientQuestionUseCase(
        patientQuestionRepository
      );
      return updatePatientQuestionUseCase.execute(id, data);
    },
    mutationKey: [patientQuestionConfig.queryKey, 'update'],
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [patientQuestionConfig.queryKey] });
    },
  });
};
