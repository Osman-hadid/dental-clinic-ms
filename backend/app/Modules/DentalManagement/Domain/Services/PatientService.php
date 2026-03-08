<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Application\DTOs\PatientData;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use App\Modules\DentalManagement\Domain\Entities\PatientQuestion;
use App\Modules\DentalManagement\Domain\Repositories\PatientRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final readonly class PatientService
{
    public function __construct(private PatientRepositoryInterface $patientRepository) {}

    public function listPatients(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->patientRepository->paginate($querySpecification);
    }

    public function getPatient(int $id): Patient
    {
        return $this->patientRepository->find(id: $id);
    }

    public function restorePatient(int $id): Patient
    {
        return tap(
            $this->patientRepository->restore($id),
            fn () => $this->patientRepository->invalidateCache()
        );
    }

    public function createPatient(PatientData $patientData): Patient
    {
        $data = $patientData->toArray();
        unset($data['patient_code']);

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $data['patient_code'] = $this->generatePatientCode();

            try {
                return DB::transaction(function () use ($data, $patientData): Patient {
                    $patient = $this->patientRepository->create(data: $data);
                    $this->syncQuestionnaireResponses($patient, $patientData->questionnaireResponses);
                    $this->patientRepository->invalidateCache();

                    return $patient->load(['questionnaireResponses.question']);
                });
            } catch (QueryException $exception) {
                if (!$this->isDuplicatePatientCodeException($exception)) {
                    throw $exception;
                }
            }
        }

        throw new RuntimeException('Failed to generate a unique patient code.');
    }

    public function updatePatient(int $id, PatientData $patientData): Patient
    {
        $data = $patientData->toArray();
        unset($data['patient_code']);

        return DB::transaction(function () use ($id, $data, $patientData): Patient {
            $patient = $this->patientRepository->update(id: $id, data: $data);
            $this->syncQuestionnaireResponses($patient, $patientData->questionnaireResponses);
            $this->patientRepository->invalidateCache();

            return $patient->load(['questionnaireResponses.question']);
        });
    }

    public function deletePatient(int $id): void
    {
        $this->patientRepository->delete(id: $id);
        $this->patientRepository->invalidateCache();
    }

    public function forceDeletePatient(int $id): void
    {
        $permission = $this->patientRepository->findTrashed($id) ?? $this->patientRepository->find($id);
        $this->patientRepository->forceDelete($permission->id);
        $this->patientRepository->invalidateCache();
    }

    public function bulkDeletePatients(array $ids): array
    {
        $deleted = [];
        $skipped = [];

        foreach ($ids as $id) {
            $patient = $this->patientRepository->find($id);

            if (method_exists($patient, 'hasRelatedRecords') && $patient->hasRelatedRecords()) {
                $skipped[] = $id;

                continue;
            }

            $this->patientRepository->delete(id: $id);
            $deleted[] = $id;
        }

        $this->patientRepository->invalidateCache();

        return ['deleted' => $deleted, 'skipped' => $skipped];
    }

    private function generatePatientCode(): string
    {
        $today = now()->format('Y-m-d');
        $pattern = '/^P#(\\d+)-'.preg_quote($today, '/').'$/';

        $maxSequence = Patient::withTrashed()
            ->where('patient_code', 'like', "P#%-{$today}")
            ->pluck('patient_code')
            ->reduce(function (int $max, mixed $value) use ($pattern): int {
                if (!is_string($value)) {
                    return $max;
                }

                if (!preg_match($pattern, $value, $matches)) {
                    return $max;
                }

                return max($max, (int) $matches[1]);
            }, 0);

        return 'P#'.($maxSequence + 1)."-{$today}";
    }

    private function isDuplicatePatientCodeException(QueryException $exception): bool
    {
        if ((string) $exception->getCode() !== '23000') {
            return false;
        }

        $message = strtolower((string) $exception->getMessage());

        return str_contains($message, 'patient_code') || str_contains($message, 'patients_patient_code_unique');
    }

    private function syncQuestionnaireResponses(Patient $patient, array $responses): void
    {
        if (!is_array($responses)) {
            return;
        }

        $normalizedResponses = collect($responses)
            ->filter(fn (mixed $response): bool => is_array($response))
            ->map(function (array $response): ?array {
                $questionId = $response['questionId'] ?? null;
                if (!is_numeric($questionId)) {
                    return null;
                }

                return [
                    'patient_question_id' => (int) $questionId,
                    'answer' => $this->normalizeAnswer($response['answer'] ?? null),
                ];
            })
            ->filter()
            ->values();

        if ($normalizedResponses->isEmpty()) {
            if (!PatientQuestion::query()->where('is_active', true)->exists()) {
                return;
            }

            $patient->questionnaireResponses()->delete();

            return;
        }

        $answerTypeByQuestionId = PatientQuestion::query()
            ->whereIn('id', $normalizedResponses->pluck('patient_question_id')->all())
            ->pluck('answer_type', 'id');

        $rowsToKeep = $normalizedResponses
            ->map(function (array $response) use ($answerTypeByQuestionId, $patient): ?array {
                $answerType = (string) ($answerTypeByQuestionId[$response['patient_question_id']] ?? 'text');
                $answer = $this->normalizeAnswerForType($response['answer'], $answerType);

                if ($answer === null) {
                    return null;
                }

                return [
                    'patient_id' => $patient->id,
                    'patient_question_id' => $response['patient_question_id'],
                    'answer' => $answer,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            })
            ->filter()
            ->values();

        $keepIds = $rowsToKeep->pluck('patient_question_id')->all();

        if ($keepIds === []) {
            $patient->questionnaireResponses()->delete();

            return;
        }

        $patient->questionnaireResponses()
            ->whereNotIn('patient_question_id', $keepIds)
            ->delete();

        DB::table('patient_question_answers')->upsert(
            $rowsToKeep->all(),
            ['patient_id', 'patient_question_id'],
            ['answer', 'updated_at']
        );
    }

    private function normalizeAnswer(mixed $answer): ?string
    {
        if ($answer === null) {
            return null;
        }

        if (is_bool($answer)) {
            return $answer ? 'yes' : 'no';
        }

        if (is_scalar($answer)) {
            $normalized = trim((string) $answer);

            return $normalized === '' ? null : $normalized;
        }

        return null;
    }

    private function normalizeAnswerForType(?string $answer, string $answerType): ?string
    {
        if ($answer === null) {
            return null;
        }

        return match ($answerType) {
            'yes_no' => in_array(strtolower($answer), ['1', 'true', 'yes'], true) ? 'yes' : 'no',
            default => $answer,
        };
    }
}
