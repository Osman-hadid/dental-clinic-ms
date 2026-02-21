<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\DTOs;

use App\Modules\Common\Infrastructure\Traits\IdCaster;

final readonly class StaffData
{
    use IdCaster;

    public function __construct(
        public string $fullName,
        public string $role,
        public ?string $specialization,
        public ?string $contactNumber,
        public ?string $email,
        public ?string $hireDate,
        public ?string $remarks,
        public ?int $createdBy,
        public ?int $updatedBy,
        public ?int $deletedBy,
        public bool $enabled = true,
        public array $appointments = [],
        public array $visits = [],
        public array $visitTreatments = [],
    ) {}

    public static function fromArray(array $data): self
    {
        $ids = self::castIds(['createdBy', 'updatedBy', 'deletedBy'], $data);

        return new self(
            fullName: $data['fullName'] ?? null,
            role: $data['role'] ?? null,
            specialization: $data['specialization'] ?? null,
            contactNumber: $data['contactNumber'] ?? null,
            email: $data['email'] ?? null,
            hireDate: $data['hireDate'] ?? null,
            remarks: $data['remarks'] ?? null,
            createdBy: $ids['createdBy'] ?? null,
            updatedBy: $ids['updatedBy'] ?? null,
            deletedBy: $ids['deletedBy'] ?? null,
            enabled: $data['enabled'] ?? true,
            appointments: $data['appointments'] ?? [],
            visits: $data['visits'] ?? [],
            visitTreatments: $data['visitTreatments'] ?? [],
        );
    }

    public function toArray(): array
    {
        return [
            'full_name' => $this->fullName,
            'role' => $this->role,
            'specialization' => $this->specialization,
            'contact_number' => $this->contactNumber,
            'email' => $this->email,
            'hire_date' => $this->hireDate,
            'enabled' => $this->enabled,
            'remarks' => $this->remarks,
            'created_by' => $this->createdBy,
            'updated_by' => $this->updatedBy,
            'deleted_by' => $this->deletedBy,
        ];
    }
}
