<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\PatientQuestion;

use App\Modules\DentalManagement\Application\DTOs\PatientQuestionData;
use App\Modules\DentalManagement\Domain\Entities\PatientQuestion;
use App\Modules\DentalManagement\Domain\Services\PatientQuestionService;

final readonly class CreatePatientQuestionUseCase
{
    public function __construct(private PatientQuestionService $patientQuestionService) {}

    public function execute(PatientQuestionData $patientQuestionData): PatientQuestion
    {
        return $this->patientQuestionService->createPatientQuestion($patientQuestionData->toArray());
    }
}
