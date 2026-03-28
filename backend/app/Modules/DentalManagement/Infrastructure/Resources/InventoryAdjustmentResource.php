<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Resources;

use App\Modules\Common\Infrastructure\Resources\Concerns\ResolvesUserStamps;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class InventoryAdjustmentResource extends JsonResource
{
    use ResolvesUserStamps;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'inventoryItemId' => $this->inventory_item_id,
            'itemName' => $this->inventoryItem?->item_name,
            'adjustmentType' => $this->adjustment_type,
            'quantity' => $this->quantity,
            'unitCostSnapshot' => $this->unit_cost_snapshot,
            'totalCostImpact' => $this->total_cost_impact,
            'adjustmentDate' => $this->adjustment_date?->format('Y-m-d'),
            'notes' => $this->notes,
            'createdBy' => $this->resolveUserStampName($this->created_by),
            'updatedBy' => $this->resolveUserStampName($this->updated_by),
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
