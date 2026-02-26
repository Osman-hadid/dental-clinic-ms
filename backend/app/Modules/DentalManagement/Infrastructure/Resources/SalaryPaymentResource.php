<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

final class SalaryPaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return $this->filterEmpty([
            'id' => $this->id,
            'staffId' => $this->staff_id,
            'staff' => $this->whenLoaded('staff'),
            'salaryMonth' => $this->salary_month,
            'paymentDate' => $this->formatDate($this->payment_date),
            'grossAmount' => $this->gross_amount,
            'grossAmountInput' => $this->gross_amount_input,
            'bonusAmount' => $this->bonus_amount,
            'bonusAmountInput' => $this->bonus_amount_input,
            'deductionAmount' => $this->deduction_amount,
            'deductionAmountInput' => $this->deduction_amount_input,
            'netAmount' => $this->net_amount,
            'netAmountInput' => $this->net_amount_input,
            'currency' => $this->currency,
            'exchangeRate' => $this->exchange_rate,
            'status' => $this->status,
            'paidFromSafe' => $this->paid_from_safe,
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
