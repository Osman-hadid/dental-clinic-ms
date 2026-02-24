<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Visit;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class UpdateVisitRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'appointmentId' => 'nullable|integer|exists:appointments,id',
            'patientId' => 'required|integer|exists:patients,id',
            'dentistId' => 'required|integer|exists:staff,id',
            'tag' => 'required|string|max:100',
            'visitDate' => 'required|date_format:Y-m-d',
            'diagnosisNotes' => 'nullable|string|max:255',
            'nextVisitDate' => 'nullable|date_format:Y-m-d|after_or_equal:visitDate',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
