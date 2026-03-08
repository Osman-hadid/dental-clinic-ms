<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Shareholder;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class StoreShareholderRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'fullName' => 'required|string|max:160',
            'contactNumber' => 'nullable|string|max:40',
            'email' => 'nullable|email|max:160',
            'address' => 'nullable|string|max:255',
            'ownershipPercentage' => 'required|numeric|min:0|max:100',
            'initialCapital' => 'required|numeric|min:0',
            'currency' => 'nullable|string|in:AFN',
            'exchangeRate' => 'nullable|numeric|gt:0',
            'joinedDate' => 'nullable|date_format:Y-m-d',
            'status' => 'nullable|string|in:active,inactive',
            'notes' => 'nullable|string|max:255',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
