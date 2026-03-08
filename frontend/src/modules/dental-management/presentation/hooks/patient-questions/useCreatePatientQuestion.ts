import { CreatePatientQuestionUseCase } from '@/modules/dental-management/application/use-cases/patient-questions/create-patient-question-use-case';
import { type PatientQuestion } from '@/modules/dental-management/domain/entities/PatientQuestion';
import { PatientQuestionRepository } from '@/modules/dental-management/infrastructure/repositories/patient-question-repository';
import { type ApiResponse } from '@/types/ApiResponse';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { patientQuestionConfig } from '../../config/patient-question-config';

export const useCreatePatientQuestion = (): UseMutationResult<
  ApiResponse<PatientQuestion>,
  Error,
  Omit<PatientQuestion, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patientQuestion) => {
      const patientQuestionRepository = new PatientQuestionRepository();
      const createPatientQuestionUseCase = new CreatePatientQuestionUseCase(
        patientQuestionRepository
      );
      return createPatientQuestionUseCase.execute(patientQuestion);
    },
    mutationKey: [patientQuestionConfig.queryKey, 'create'],
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [patientQuestionConfig.queryKey] });
    },
  });
};
