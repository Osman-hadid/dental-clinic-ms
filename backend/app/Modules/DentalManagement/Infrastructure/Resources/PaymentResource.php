<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;
use App\Modules\Common\Infrastructure\Resources\Concerns\ResolvesUserStamps;

class PaymentResource extends JsonResource
{
    use ResolvesUserStamps;

    public function toArray(Request $request): array
    {
        return $this->filterEmpty([
            'id' => $this->id,
            'invoiceId' => $this->invoice_id,
            'paymentDate' => $this->formatDate($this->payment_date),
            'amount' => $this->amount,
            'amountInput' => $this->amount_input,
            'currency' => $this->currency,
            'exchangeRate' => $this->exchange_rate,
            'method' => $this->method,
            'notes' => $this->notes,
            'createdBy' => $this->resolveUserStampName($this->created_by),
            'updatedBy' => $this->resolveUserStampName($this->updated_by),
            'deletedBy' => $this->deleted_by,
            'invoice' => $this->invoice,
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ]);
    }

    private function filterEmpty(array $data): array
    {
        return array_filter($data, fn ($value): bool => !\in_array($value, [null, '', []], true) && !($value instanceof Collection && $value->isEmpty()));
    }

    private function formatDate(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return $value instanceof \DateTimeInterface ? $value->format('Y-m-d') : (string) $value;
    }
}
