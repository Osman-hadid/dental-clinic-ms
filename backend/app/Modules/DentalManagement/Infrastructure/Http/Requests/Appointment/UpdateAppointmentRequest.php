<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Appointment;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class UpdateAppointmentRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'patientId' => 'required|integer|exists:patients,id',
            'dentistId' => 'required|integer|exists:staff,id',
            'appointmentDate' => 'required|date',
            'startTime' => 'required|string|max:255',
            'endTime' => 'nullable|string|max:255',
            'status' => 'nullable|nullable|string|in:scheduled,completed,cancelled',
            'notes' => 'nullable|string|max:255',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
