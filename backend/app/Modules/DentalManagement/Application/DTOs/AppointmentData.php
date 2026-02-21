<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\DTOs;

use App\Modules\Common\Infrastructure\Traits\IdCaster;

final readonly class AppointmentData
{
    use IdCaster;

    public function __construct(
        public int $patientId,
        public int $dentistId,
        public string $appointmentDate,
        public string $startTime,
        public ?string $endTime,
        public ?string $notes,
        public ?int $createdBy,
        public ?int $updatedBy,
        public ?int $deletedBy,
        public string $status = 'scheduled',
        public array $visits = [],
    ) {}

    public static function fromArray(array $data): self
    {
        $ids = self::castIds(['patientId', 'dentistId', 'createdBy', 'updatedBy', 'deletedBy'], $data);

        return new self(
            patientId: $ids['patientId'] ?? null,
            dentistId: $ids['dentistId'] ?? null,
            appointmentDate: $data['appointmentDate'] ?? null,
            startTime: $data['startTime'] ?? null,
            endTime: $data['endTime'] ?? null,
            notes: $data['notes'] ?? null,
            createdBy: $ids['createdBy'] ?? null,
            updatedBy: $ids['updatedBy'] ?? null,
            deletedBy: $ids['deletedBy'] ?? null,
            status: $data['status'] ?? 'scheduled',
            visits: $data['visits'] ?? [],
        );
    }

    public function toArray(): array
    {
        return [
            'patient_id' => $this->patientId,
            'dentist_id' => $this->dentistId,
            'appointment_date' => $this->appointmentDate,
            'start_time' => $this->startTime,
            'end_time' => $this->endTime,
            'status' => $this->status,
            'notes' => $this->notes,
            'created_by' => $this->createdBy,
            'updated_by' => $this->updatedBy,
            'deleted_by' => $this->deletedBy,
        ];
    }
}
