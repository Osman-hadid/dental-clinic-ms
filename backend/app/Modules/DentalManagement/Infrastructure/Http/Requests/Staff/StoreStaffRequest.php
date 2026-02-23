<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Staff;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class StoreStaffRequest extends BaseFormRequest
{
    protected array $booleanFields = ['enabled'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'fullName' => 'required|string|max:255',
            'role' => 'required|string|in:dentist,assistant,reception,admin',
            'specialization' => 'nullable|string|max:255',
            'contactNumber' => 'nullable|string|max:255|unique:staff,contact_number',
            'email' => 'nullable|string|max:255|unique:staff,email',
            'hireDate' => 'nullable|date_format:Y-m-d',
            'enabled' => 'nullable|boolean',
            'remarks' => 'nullable|string|max:255',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
