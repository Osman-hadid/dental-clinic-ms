<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\InventoryItem;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class StoreInventoryAdjustmentRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'adjustmentType' => 'required|string|in:waste,loss',
            'quantity' => 'required|integer|min:1',
            'adjustmentDate' => 'required|date_format:Y-m-d',
            'notes' => 'nullable|string|max:500',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
