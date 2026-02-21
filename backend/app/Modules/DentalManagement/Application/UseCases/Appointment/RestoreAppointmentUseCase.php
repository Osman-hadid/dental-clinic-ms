<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Appointment;

use App\Modules\DentalManagement\Domain\Entities\Appointment;
use App\Modules\DentalManagement\Domain\Services\AppointmentService;

final readonly class RestoreAppointmentUseCase
{
    public function __construct(private AppointmentService $appointmentService) {}

    public function execute(int $id): Appointment
    {
        return $this->appointmentService->restoreAppointment($id);
    }
}
