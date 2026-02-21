import { type PatientRepositoryInterface } from '@/modules/dental-management/domain/interfaces/PatientRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class DeletePatientUseCase {
  constructor(private readonly patientRepository: PatientRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<null>> {
    return await this.patientRepository.deletePatient(id);
  }
}
