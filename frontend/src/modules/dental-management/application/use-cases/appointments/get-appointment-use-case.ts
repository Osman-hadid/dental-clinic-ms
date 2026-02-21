import { type Appointment } from '@/modules/dental-management/domain/entities/Appointment';
import { type AppointmentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/AppointmentRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class GetAppointmentUseCase {
  constructor(private readonly appointmentRepository: AppointmentRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<Appointment>> {
    return this.appointmentRepository.getAppointment(id);
  }
}
