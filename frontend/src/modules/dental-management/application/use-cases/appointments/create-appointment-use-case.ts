import { type Appointment } from '@/modules/dental-management/domain/entities/Appointment';
import { type AppointmentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/AppointmentRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class CreateAppointmentUseCase {
  constructor(private readonly appointmentRepository: AppointmentRepositoryInterface) {}

  async execute(
    appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Appointment>> {
    return await this.appointmentRepository.createAppointment(appointment);
  }
}
