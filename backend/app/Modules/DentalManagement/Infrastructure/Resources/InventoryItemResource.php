<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

final class InventoryItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return $this->filterEmpty([
            'id' => $this->id,
            'acquisitionSource' => $this->acquisition_source,
            'entryDate' => $this->formatDate($this->entry_date),
            'itemName' => $this->item_name,
            'category' => $this->category,
            'quantity' => $this->quantity,
            'unit' => $this->unit,
            'minStock' => $this->min_stock,
            'unitCost' => $this->unit_cost,
            'totalCost' => $this->total_cost,
            'supplier' => $this->supplier,
            'lotNumber' => $this->lot_number,
            'expiryDate' => $this->formatDate($this->expiry_date),
            'location' => $this->location,
            'notes' => $this->notes,
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ]);
    }

    private function filterEmpty(array $data): array
    {
        return array_filter(
            $data,
            fn ($value): bool => !\in_array($value, [null, '', []], true)
                && !($value instanceof Collection && $value->isEmpty())
        );
    }

    private function formatDate(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return $value instanceof \DateTimeInterface ? $value->format('Y-m-d') : (string) $value;
    }
}

