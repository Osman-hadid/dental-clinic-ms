import { type PatientQuestionRepositoryInterface } from '@/modules/dental-management/domain/interfaces/PatientQuestionRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class DeletePatientQuestionUseCase {
  constructor(private readonly patientQuestionRepository: PatientQuestionRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<null>> {
    return this.patientQuestionRepository.deletePatientQuestion(id);
  }
}
