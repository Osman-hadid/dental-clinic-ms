<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Appointment;

use App\Modules\Common\Infrastructure\Http\Requests\BulkDeleteRequest;

final class BulkDeleteAppointmentsRequest extends BulkDeleteRequest
{
    protected function tableName(): string
    {
        return 'appointments';
    }

    protected function entityName(): string
    {
        return 'Appointment';
    }

    public function authorize(): bool
    {
        return true;
    }
}
