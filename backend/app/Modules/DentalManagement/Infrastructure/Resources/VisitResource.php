<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

class VisitResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return $this->filterEmpty([
            'id' => $this->id,
            'appointmentId' => $this->appointment_id,
            'patientId' => $this->patient_id,
            'dentistId' => $this->dentist_id,
            'appointmentTag' => $this->appointmentTag(),
            'patientName' => $this->patientName(),
            'dentistName' => $this->dentistName(),
            'tag' => $this->tag,
            'visitDate' => $this->formatDate($this->visit_date),
            'diagnosisNotes' => $this->diagnosis_notes,
            'nextVisitDate' => $this->formatDate($this->next_visit_date),
            'createdBy' => $this->created_by,
            'updatedBy' => $this->updated_by,
            'deletedBy' => $this->deleted_by,
            'appointment' => $this->appointment,
            'patient' => $this->patient,
            'dentist' => $this->dentist,
            'visitTreatments' => $this->visitTreatments,
            'invoices' => $this->invoices,
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

    private function appointmentTag(): ?string
    {
        $appointment = $this->appointment;
        if (!$appointment) {
            return null;
        }

        $tag = trim((string) ($appointment->tag ?? ''));

        return $tag !== '' ? $tag : null;
    }

    private function patientName(): ?string
    {
        $patient = $this->patient;
        if (!$patient) {
            return null;
        }

        $firstName = trim((string) ($patient->first_name ?? $patient->firstName ?? ''));
        $lastName = trim((string) ($patient->last_name ?? $patient->lastName ?? ''));
        $fullName = trim("{$firstName} {$lastName}");

        if ($fullName !== '') {
            return $fullName;
        }

        $patientCode = trim((string) ($patient->patient_code ?? $patient->patientCode ?? ''));

        return $patientCode !== '' ? $patientCode : null;
    }

    private function dentistName(): ?string
    {
        $dentist = $this->dentist;
        if (!$dentist) {
            return null;
        }

        $fullName = trim((string) ($dentist->full_name ?? $dentist->fullName ?? $dentist->name ?? ''));
        if ($fullName !== '') {
            return $fullName;
        }

        $firstName = trim((string) ($dentist->first_name ?? $dentist->firstName ?? ''));
        $lastName = trim((string) ($dentist->last_name ?? $dentist->lastName ?? ''));
        $name = trim("{$firstName} {$lastName}");

        return $name !== '' ? $name : null;
    }
}
