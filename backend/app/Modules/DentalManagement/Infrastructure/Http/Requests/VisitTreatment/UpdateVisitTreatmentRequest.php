<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\VisitTreatment;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class UpdateVisitTreatmentRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'visitId' => 'required|integer|exists:visits,id',
            'treatmentId' => 'required|integer|exists:treatments,id',
            'toothId' => 'nullable|integer|exists:teeth,id',
            'toothNumber' => 'nullable|string|max:255',
            'dentistId' => 'nullable|integer|exists:staff,id',
            'price' => 'required|string|max:255',
            'material' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:255',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
