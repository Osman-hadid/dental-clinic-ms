<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Visit;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class StoreVisitRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'appointmentId' => 'required|integer|exists:appointments,id',
            'patientId' => 'required|integer|exists:patients,id',
            'dentistId' => 'required|integer|exists:staff,id',
            'visitDate' => 'required|date',
            'diagnosisNotes' => 'nullable|string|max:255',
            'nextVisitDate' => 'nullable|date',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
