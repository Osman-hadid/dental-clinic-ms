<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\PatientQuestion;

use App\Modules\DentalManagement\Domain\Services\PatientQuestionService;

final readonly class DeletePatientQuestionUseCase
{
    public function __construct(private PatientQuestionService $patientQuestionService) {}

    public function execute(int $id): void
    {
        $this->patientQuestionService->deletePatientQuestion($id);
    }
}
