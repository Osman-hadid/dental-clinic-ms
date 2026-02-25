<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\DTOs;

use App\Modules\Common\Infrastructure\Traits\IdCaster;

final readonly class InvoiceData
{
    use IdCaster;

    public function __construct(
        public int $patientId,
        public int $visitId,
        public float $totalAmount,
        public float $netAmount,
        public string $invoiceDate,
        public ?string $notes,
        public ?int $createdBy,
        public ?int $updatedBy,
        public ?int $deletedBy,
        public float $discount = 0,
        public string $status = 'unpaid',
        public string $paymentType = 'cash',
        public array $sourceVisitIds = [],
        public array $payments = [],
    ) {}

    public static function fromArray(array $data): self
    {
        $ids = self::castIds(['patientId', 'visitId', 'createdBy', 'updatedBy', 'deletedBy'], $data);

        return new self(
            patientId: $ids['patientId'] ?? null,
            visitId: $ids['visitId'] ?? null,
            totalAmount: round((float) ($data['totalAmount'] ?? 0), 2),
            netAmount: round((float) ($data['netAmount'] ?? 0), 2),
            invoiceDate: $data['invoiceDate'] ?? null,
            notes: $data['notes'] ?? null,
            createdBy: $ids['createdBy'] ?? null,
            updatedBy: $ids['updatedBy'] ?? null,
            deletedBy: $ids['deletedBy'] ?? null,
            discount: round((float) ($data['discount'] ?? 0), 2),
            status: $data['status'] ?? 'unpaid',
            paymentType: $data['paymentType'] ?? 'cash',
            sourceVisitIds: array_values(array_unique(
                array_map(
                    static fn (mixed $value): int => (int) $value,
                    is_array($data['sourceVisitIds'] ?? null) ? $data['sourceVisitIds'] : []
                )
            )),
            payments: $data['payments'] ?? [],
        );
    }

    public function toArray(): array
    {
        return [
            'patient_id' => $this->patientId,
            'visit_id' => $this->visitId,
            'total_amount' => $this->totalAmount,
            'discount' => $this->discount,
            'net_amount' => $this->netAmount,
            'invoice_date' => $this->invoiceDate,
            'status' => $this->status,
            'payment_type' => $this->paymentType,
            'source_visit_ids' => $this->sourceVisitIds,
            'notes' => $this->notes,
            'created_by' => $this->createdBy,
            'updated_by' => $this->updatedBy,
            'deleted_by' => $this->deletedBy,
        ];
    }
}
