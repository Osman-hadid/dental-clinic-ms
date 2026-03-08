import { type PatientQuestion } from '@/modules/dental-management/domain/entities/PatientQuestion';
import { type PatientQuestionRepositoryInterface } from '@/modules/dental-management/domain/interfaces/PatientQuestionRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class CreatePatientQuestionUseCase {
  constructor(private readonly patientQuestionRepository: PatientQuestionRepositoryInterface) {}

  async execute(
    patientQuestion: Omit<PatientQuestion, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  ): Promise<ApiResponse<PatientQuestion>> {
    return this.patientQuestionRepository.createPatientQuestion(patientQuestion);
  }
}
