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
            'materialItems' => 'nullable|array',
            'materialItems.*.inventoryItemId' => 'required_with:materialItems|integer|exists:inventory_items,id',
            'materialItems.*.quantity' => 'required_with:materialItems|integer|min:1',
            'prescription' => 'nullable|array',
            'prescription.name' => 'nullable|string|max:160',
            'prescription.amount' => 'nullable|string|max:64',
            'prescription.frequency' => 'nullable|string|max:120',
            'prescription.foodTiming' => 'nullable|string|in:before_food,after_food,with_food,anytime',
            'prescription.items' => 'nullable|array',
            'prescription.items.*.name' => 'required_with:prescription.items|string|max:160',
            'prescription.items.*.amount' => 'required_with:prescription.items|string|max:64',
            'prescription.items.*.frequency' => 'required_with:prescription.items|string|max:120',
            'prescription.items.*.foodTiming' => 'required_with:prescription.items|string|in:before_food,after_food,with_food,anytime',
            'prescription.content' => 'nullable|string|max:5000',
            'createdBy' => 'nullable|integer',
            'updatedBy' => 'nullable|integer',
            'deletedBy' => 'nullable|integer',
        ];
    }
}
