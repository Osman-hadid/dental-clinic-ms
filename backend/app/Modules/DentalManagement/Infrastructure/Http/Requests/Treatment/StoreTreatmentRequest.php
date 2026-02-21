<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Treatment;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class StoreTreatmentRequest extends BaseFormRequest
{
    protected array $booleanFields = ['enabled'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'category' => 'required|string|max:255',
            'defaultPrice' => 'required|string|max:255',
            'durationMinutes' => 'nullable|integer',
            'description' => 'nullable|string|max:255',
            'enabled' => 'nullable|boolean',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
