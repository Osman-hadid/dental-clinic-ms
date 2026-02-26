<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

final class SafeTransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return $this->filterEmpty([
            'id' => $this->id,
            'transactionDate' => $this->formatDate($this->transaction_date),
            'entryType' => $this->entry_type,
            'direction' => $this->direction,
            'amount' => $this->amount,
            'amountInput' => $this->amount_input,
            'currency' => $this->currency,
            'exchangeRate' => $this->exchange_rate,
            'sourceId' => $this->source_id,
            'sourceType' => $this->source_type,
            'pickedByStaffId' => $this->picked_by_staff_id,
            'pickedByStaff' => $this->whenLoaded('pickedByStaff'),
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
