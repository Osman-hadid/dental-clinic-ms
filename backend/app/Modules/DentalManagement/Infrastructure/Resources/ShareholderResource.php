<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

final class ShareholderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $contributedAmount = round((float) ($this->total_contribution_amount ?? 0), 2);
        $distributedAmount = round((float) ($this->total_distribution_amount ?? 0), 2);
        $balanceAmount = round($contributedAmount - $distributedAmount, 2);

        return $this->filterEmpty([
            'id' => $this->id,
            'fullName' => $this->full_name,
            'contactNumber' => $this->contact_number,
            'email' => $this->email,
            'address' => $this->address,
            'ownershipPercentage' => $this->ownership_percentage,
            'initialCapital' => $this->initial_capital,
            'initialCapitalInput' => $this->initial_capital_input,
            'currency' => $this->currency,
            'exchangeRate' => $this->exchange_rate,
            'joinedDate' => $this->formatDate($this->joined_date),
            'status' => $this->status,
            'notes' => $this->notes,
            'contributedAmount' => $contributedAmount,
            'distributedAmount' => $distributedAmount,
            'balanceAmount' => $balanceAmount,
            'transactions' => $this->whenLoaded('transactions', fn () => ShareholderTransactionResource::collection($this->transactions)),
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
