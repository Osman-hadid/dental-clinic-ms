<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Appointment;

use App\Modules\DentalManagement\Application\DTOs\AppointmentData;
use App\Modules\DentalManagement\Domain\Entities\Appointment;
use App\Modules\DentalManagement\Domain\Services\AppointmentService;

final readonly class UpdateAppointmentUseCase
{
    public function __construct(private AppointmentService $appointmentService) {}

    public function execute(int $id, AppointmentData $appointmentData): Appointment
    {
        return $this->appointmentService->updateAppointment(id: $id, data: $appointmentData->toArray());
    }
}
