<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\PatientQuestion;
use App\Modules\DentalManagement\Domain\Repositories\PatientQuestionRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class PatientQuestionService
{
    public function __construct(private PatientQuestionRepositoryInterface $patientQuestionRepository) {}

    public function listPatientQuestions(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->patientQuestionRepository->paginate($querySpecification);
    }

    public function getPatientQuestion(int $id): PatientQuestion
    {
        return $this->patientQuestionRepository->find($id);
    }

    public function createPatientQuestion(array $data): PatientQuestion
    {
        return tap(
            $this->patientQuestionRepository->create($data),
            fn () => $this->patientQuestionRepository->invalidateCache()
        );
    }

    public function updatePatientQuestion(int $id, array $data): PatientQuestion
    {
        return tap(
            $this->patientQuestionRepository->update($id, $data),
            fn () => $this->patientQuestionRepository->invalidateCache()
        );
    }

    public function deletePatientQuestion(int $id): void
    {
        $this->patientQuestionRepository->delete($id);
        $this->patientQuestionRepository->invalidateCache();
    }
}
