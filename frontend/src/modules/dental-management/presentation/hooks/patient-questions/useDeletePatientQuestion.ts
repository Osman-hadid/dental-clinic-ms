import { DeletePatientQuestionUseCase } from '@/modules/dental-management/application/use-cases/patient-questions/delete-patient-question-use-case';
import { PatientQuestionRepository } from '@/modules/dental-management/infrastructure/repositories/patient-question-repository';
import { type ApiResponse } from '@/types/ApiResponse';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { patientQuestionConfig } from '../../config/patient-question-config';

export const useDeletePatientQuestion = (): UseMutationResult<
  ApiResponse<null>,
  Error,
  string | number
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => {
      const patientQuestionRepository = new PatientQuestionRepository();
      const deletePatientQuestionUseCase = new DeletePatientQuestionUseCase(
        patientQuestionRepository
      );
      return deletePatientQuestionUseCase.execute(id);
    },
    mutationKey: [patientQuestionConfig.queryKey, 'delete'],
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [patientQuestionConfig.queryKey] });
    },
  });
};
