<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\InventoryItem;

use App\Modules\Common\Infrastructure\Http\Requests\BaseFormRequest;

final class StoreInventoryItemRequest extends BaseFormRequest
{
    protected array $booleanFields = [];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'acquisitionSource' => 'required|string|in:previous_stock,purchase',
            'entryDate' => 'required|date_format:Y-m-d',
            'itemName' => 'required|string|max:160',
            'category' => 'required|string|in:consumable,medicine,instrument,implant,ppe,other',
            'quantity' => 'required|integer|min:0',
            'unit' => 'required|string|in:piece,box,pack,bottle,tube,set,kit,pair,unit',
            'minStock' => 'nullable|integer|min:0',
            'unitCost' => 'nullable|numeric|min:0',
            'supplier' => 'nullable|string|max:160',
            'lotNumber' => 'nullable|string|max:120',
            'expiryDate' => 'nullable|date_format:Y-m-d',
            'location' => 'nullable|string|max:160',
            'notes' => 'nullable|string|max:255',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}

