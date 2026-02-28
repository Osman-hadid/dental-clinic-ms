<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

final class DebtResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return $this->filterEmpty([
            'id' => $this->id,
            'invoiceId' => $this->invoice_id,
            'patientId' => $this->patient_id,
            'invoiceDate' => $this->formatDate($this->invoice_date),
            'netAmount' => $this->net_amount,
            'paidAmount' => $this->paid_amount,
            'debtAmount' => $this->debt_amount,
            'status' => $this->status,
            'currency' => $this->currency,
            'patient' => $this->patient,
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

