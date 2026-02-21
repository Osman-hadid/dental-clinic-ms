import { type AppointmentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/AppointmentRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class DeleteAppointmentUseCase {
  constructor(private readonly appointmentRepository: AppointmentRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<null>> {
    return await this.appointmentRepository.deleteAppointment(id);
  }
}
