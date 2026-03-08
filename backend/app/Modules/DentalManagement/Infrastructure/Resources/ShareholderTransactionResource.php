<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

final class ShareholderTransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return $this->filterEmpty([
            'id' => $this->id,
            'shareholderId' => $this->shareholder_id,
            'shareholder' => $this->whenLoaded('shareholder'),
            'transactionDate' => $this->formatDate($this->transaction_date),
            'transactionType' => $this->transaction_type,
            'amount' => $this->amount,
            'amountInput' => $this->amount_input,
            'currency' => $this->currency,
            'exchangeRate' => $this->exchange_rate,
            'safeTransactionId' => $this->safe_transaction_id,
            'safeTransaction' => $this->whenLoaded('safeTransaction'),
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
