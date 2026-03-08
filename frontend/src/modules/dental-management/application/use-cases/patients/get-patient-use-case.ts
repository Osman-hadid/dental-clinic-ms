import { type Patient } from '@/modules/dental-management/domain/entities/Patient';
import { type PatientRepositoryInterface } from '@/modules/dental-management/domain/interfaces/PatientRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class GetPatientUseCase {
  constructor(private readonly patientRepository: PatientRepositoryInterface) {}

  async execute(id: string | number, relations: string[] = []): Promise<ApiResponse<Patient>> {
    return this.patientRepository.getPatient(id, relations);
  }
}
