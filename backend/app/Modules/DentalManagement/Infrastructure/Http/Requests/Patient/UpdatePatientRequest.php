<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Patient;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class UpdatePatientRequest extends BaseFormRequest
{
    protected array $booleanFields = ['enabled'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'patientCode' => 'nullable|string|max:255',
            'firstName' => 'required|string|max:255',
            'lastName' => 'nullable|string|max:255',
            'gender' => 'nullable|string|in:male,female',
            'dateOfBirth' => 'nullable|date_format:Y-m-d|before_or_equal:today',
            'contactNumber' => 'nullable|string|max:255',
            'email' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique(table: 'patients', column: 'email')->ignore(id: $this->route(param: 'patient')),
            ],
            'address' => 'nullable|string|max:255',
            'bloodGroup' => 'nullable|string|max:255',
            'emergencyContact' => 'nullable|string|max:255',
            'enabled' => 'nullable|boolean',
            'status' => 'nullable|string|in:pending,approved,rejected',
            'remarks' => 'nullable|string|max:255',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
