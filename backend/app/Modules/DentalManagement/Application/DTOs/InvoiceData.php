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
        public string $totalAmount,
        public string $netAmount,
        public string $invoiceDate,
        public ?string $notes,
        public ?int $createdBy,
        public ?int $updatedBy,
        public ?int $deletedBy,
        public ?string $discount = null,
        public string $status = 'unpaid',
        public array $payments = [],
    ) {}

    public static function fromArray(array $data): self
    {
        $ids = self::castIds(['patientId', 'visitId', 'createdBy', 'updatedBy', 'deletedBy'], $data);

        return new self(
            patientId: $ids['patientId'] ?? null,
            visitId: $ids['visitId'] ?? null,
            totalAmount: $data['totalAmount'] ?? null,
            netAmount: $data['netAmount'] ?? null,
            invoiceDate: $data['invoiceDate'] ?? null,
            notes: $data['notes'] ?? null,
            createdBy: $ids['createdBy'] ?? null,
            updatedBy: $ids['updatedBy'] ?? null,
            deletedBy: $ids['deletedBy'] ?? null,
            discount: $data['discount'] ?? null,
            status: $data['status'] ?? 'unpaid',
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
            'notes' => $this->notes,
            'created_by' => $this->createdBy,
            'updated_by' => $this->updatedBy,
            'deleted_by' => $this->deletedBy,
        ];
    }
}
