<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\DTOs;

use App\Modules\Common\Infrastructure\Traits\IdCaster;

final readonly class PatientData
{
    use IdCaster;

    public function __construct(
        public string $patientCode,
        public string $firstName,
        public ?string $lastName,
        public string $gender,
        public ?string $dateOfBirth,
        public ?string $contactNumber,
        public ?string $email,
        public ?string $address,
        public ?string $bloodGroup,
        public ?string $emergencyContact,
        public ?string $remarks,
        public ?int $createdBy,
        public ?int $updatedBy,
        public ?int $deletedBy,
        public bool $enabled = true,
        public string $status = 'pending',
        public array $appointments = [],
        public array $visits = [],
        public array $invoices = [],
    ) {}

    public static function fromArray(array $data): self
    {
        $ids = self::castIds(['createdBy', 'updatedBy', 'deletedBy'], $data);

        return new self(
            patientCode: $data['patientCode'] ?? null,
            firstName: $data['firstName'] ?? null,
            lastName: $data['lastName'] ?? null,
            gender: $data['gender'] ?? null,
            dateOfBirth: $data['dateOfBirth'] ?? null,
            contactNumber: $data['contactNumber'] ?? null,
            email: $data['email'] ?? null,
            address: $data['address'] ?? null,
            bloodGroup: $data['bloodGroup'] ?? null,
            emergencyContact: $data['emergencyContact'] ?? null,
            remarks: $data['remarks'] ?? null,
            createdBy: $ids['createdBy'] ?? null,
            updatedBy: $ids['updatedBy'] ?? null,
            deletedBy: $ids['deletedBy'] ?? null,
            enabled: $data['enabled'] ?? true,
            status: $data['status'] ?? 'pending',
            appointments: $data['appointments'] ?? [],
            visits: $data['visits'] ?? [],
            invoices: $data['invoices'] ?? [],
        );
    }

    public function toArray(): array
    {
        return [
            'patient_code' => $this->patientCode,
            'first_name' => $this->firstName,
            'last_name' => $this->lastName,
            'gender' => $this->gender,
            'date_of_birth' => $this->dateOfBirth,
            'contact_number' => $this->contactNumber,
            'email' => $this->email,
            'address' => $this->address,
            'blood_group' => $this->bloodGroup,
            'emergency_contact' => $this->emergencyContact,
            'enabled' => $this->enabled,
            'status' => $this->status,
            'remarks' => $this->remarks,
            'created_by' => $this->createdBy,
            'updated_by' => $this->updatedBy,
            'deleted_by' => $this->deletedBy,
        ];
    }
}
