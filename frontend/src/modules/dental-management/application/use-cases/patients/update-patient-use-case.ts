import { type Patient } from '@/modules/dental-management/domain/entities/Patient';
import { type PatientRepositoryInterface } from '@/modules/dental-management/domain/interfaces/PatientRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class UpdatePatientUseCase {
  constructor(private readonly patientRepository: PatientRepositoryInterface) {}

  async execute(
    id: string | number,
    patient: Partial<Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Patient>> {
    return await this.patientRepository.updatePatient(id, patient);
  }
}
