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
            'tag' => 'nullable|string|max:100',
            'appointmentDate' => 'required|date_format:Y-m-d',
            'startTime' => 'required|date_format:H:i',
            'endTime' => 'required|date_format:H:i|after:startTime',
            'status' => 'nullable|string|in:scheduled,completed,cancelled',
            'notes' => 'nullable|string|max:255',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
