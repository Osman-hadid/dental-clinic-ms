<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Appointment;

use App\Modules\DentalManagement\Application\DTOs\AppointmentData;
use App\Modules\DentalManagement\Domain\Entities\Appointment;
use App\Modules\DentalManagement\Domain\Services\AppointmentService;

final readonly class CreateAppointmentUseCase
{
    public function __construct(
        private AppointmentService $appointmentService
    ) {}

    public function execute(AppointmentData $appointmentData): Appointment
    {
        return $this->appointmentService->createAppointment(data: $appointmentData->toArray());
    }
}
