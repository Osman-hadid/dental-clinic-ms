<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

final class ExpenseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return $this->filterEmpty([
            'id' => $this->id,
            'expenseType' => $this->expense_type,
            'title' => $this->title,
            'category' => $this->category,
            'amount' => $this->amount,
            'amountInput' => $this->amount_input,
            'currency' => $this->currency,
            'exchangeRate' => $this->exchange_rate,
            'expenseDate' => $this->formatDate($this->expense_date),
            'paymentMethod' => $this->payment_method,
            'vendor' => $this->vendor,
            'quantity' => $this->quantity,
            'unitCost' => $this->unit_cost,
            'unitCostInput' => $this->unit_cost_input,
            'notes' => $this->notes,
            'sourceId' => $this->source_id,
            'sourceType' => $this->source_type,
            'staffId' => $this->staff_id,
            'staff' => $this->whenLoaded('staff'),
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
