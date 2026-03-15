<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\ClinicProfile;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class UpdateClinicProfileRequest extends BaseFormRequest
{
    private const NULLABLE_STRING = 'nullable|string|max:255';

    private const REQUIRED_STRING = 'required|string|max:255';

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'nullable|string|max:255',
            'ownerName' => 'nullable|string|max:255',
            'logoPath' => [
                'sometimes',
                'nullable',
                'file',
                'max:5120', // 5MB
                'mimes:jpg,jpeg,png',
            ],
            'address' => self::NULLABLE_STRING,
            'contactNumber' => self::NULLABLE_STRING,
            'email' => 'nullable|email|max:255',
            'website' => self::NULLABLE_STRING,
            'licenseNumber' => self::NULLABLE_STRING,
            'notes' => 'nullable|string|max:1000',
        ];
    }
}
