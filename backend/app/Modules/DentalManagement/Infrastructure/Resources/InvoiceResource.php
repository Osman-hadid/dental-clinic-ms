<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;
use App\Modules\Common\Infrastructure\Resources\Concerns\ResolvesUserStamps;

class InvoiceResource extends JsonResource
{
    use ResolvesUserStamps;

    public function toArray(Request $request): array
    {
        return $this->filterEmpty([
            'id' => $this->id,
            'patientId' => $this->patient_id,
            'visitId' => $this->visit_id,
            'sourceVisitIds' => $this->source_visit_ids,
            'totalAmount' => $this->total_amount,
            'totalAmountInput' => $this->total_amount_input,
            'discount' => $this->discount,
            'discountInput' => $this->discount_input,
            'netAmount' => $this->net_amount,
            'netAmountInput' => $this->net_amount_input,
            'currency' => $this->currency,
            'exchangeRate' => $this->exchange_rate,
            'invoiceDate' => $this->formatDate($this->invoice_date),
            'status' => $this->status,
            'paymentType' => $this->payment_type,
            'notes' => $this->notes,
            'createdBy' => $this->resolveUserStampName($this->created_by),
            'updatedBy' => $this->resolveUserStampName($this->updated_by),
            'deletedBy' => $this->deleted_by,
            'patient' => $this->patient,
            'visit' => $this->visit,
            'payments' => $this->payments,
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
