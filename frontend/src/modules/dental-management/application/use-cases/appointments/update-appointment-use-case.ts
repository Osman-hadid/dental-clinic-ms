import { type Appointment } from '@/modules/dental-management/domain/entities/Appointment';
import { type AppointmentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/AppointmentRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class UpdateAppointmentUseCase {
  constructor(private readonly appointmentRepository: AppointmentRepositoryInterface) {}

  async execute(
    id: string | number,
    appointment: Partial<Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Appointment>> {
    return await this.appointmentRepository.updateAppointment(id, appointment);
  }
}
