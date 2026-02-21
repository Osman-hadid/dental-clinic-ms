<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\DTOs;

use App\Modules\Common\Infrastructure\Traits\IdCaster;

final readonly class VisitData
{
    use IdCaster;

    public function __construct(
        public int $appointmentId,
        public int $patientId,
        public int $dentistId,
        public string $visitDate,
        public ?string $diagnosisNotes,
        public ?string $nextVisitDate,
        public ?int $createdBy,
        public ?int $updatedBy,
        public ?int $deletedBy,
        public array $visitTreatments = [],
        public array $invoices = [],
    ) {}

    public static function fromArray(array $data): self
    {
        $ids = self::castIds(['appointmentId', 'patientId', 'dentistId', 'createdBy', 'updatedBy', 'deletedBy'], $data);

        return new self(
            appointmentId: $ids['appointmentId'] ?? null,
            patientId: $ids['patientId'] ?? null,
            dentistId: $ids['dentistId'] ?? null,
            visitDate: $data['visitDate'] ?? null,
            diagnosisNotes: $data['diagnosisNotes'] ?? null,
            nextVisitDate: $data['nextVisitDate'] ?? null,
            createdBy: $ids['createdBy'] ?? null,
            updatedBy: $ids['updatedBy'] ?? null,
            deletedBy: $ids['deletedBy'] ?? null,
            visitTreatments: $data['visitTreatments'] ?? [],
            invoices: $data['invoices'] ?? [],
        );
    }

    public function toArray(): array
    {
        return [
            'appointment_id' => $this->appointmentId,
            'patient_id' => $this->patientId,
            'dentist_id' => $this->dentistId,
            'visit_date' => $this->visitDate,
            'diagnosis_notes' => $this->diagnosisNotes,
            'next_visit_date' => $this->nextVisitDate,
            'created_by' => $this->createdBy,
            'updated_by' => $this->updatedBy,
            'deleted_by' => $this->deletedBy,
        ];
    }
}
