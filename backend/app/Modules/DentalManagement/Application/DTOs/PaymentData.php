<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\DTOs;

use App\Modules\Common\Infrastructure\Traits\IdCaster;

final readonly class PaymentData
{
    use IdCaster;

    public function __construct(
        public int $invoiceId,
        public string $paymentDate,
        public float $amount,
        public string $method,
        public ?string $notes,
        public ?int $createdBy,
        public ?int $updatedBy,
        public ?int $deletedBy,
    ) {}

    public static function fromArray(array $data): self
    {
        $ids = self::castIds(['invoiceId', 'createdBy', 'updatedBy', 'deletedBy'], $data);

        return new self(
            invoiceId: $ids['invoiceId'] ?? null,
            paymentDate: $data['paymentDate'] ?? null,
            amount: round((float) ($data['amount'] ?? 0), 2),
            method: $data['method'] ?? null,
            notes: $data['notes'] ?? null,
            createdBy: $ids['createdBy'] ?? null,
            updatedBy: $ids['updatedBy'] ?? null,
            deletedBy: $ids['deletedBy'] ?? null,
        );
    }

    public function toArray(): array
    {
        return [
            'invoice_id' => $this->invoiceId,
            'payment_date' => $this->paymentDate,
            'amount' => $this->amount,
            'method' => $this->method,
            'notes' => $this->notes,
            'created_by' => $this->createdBy,
            'updated_by' => $this->updatedBy,
            'deleted_by' => $this->deletedBy,
        ];
    }
}
