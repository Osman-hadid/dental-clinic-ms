<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\PatientQuestion;

use App\Modules\DentalManagement\Application\DTOs\PatientQuestionData;
use App\Modules\DentalManagement\Domain\Entities\PatientQuestion;
use App\Modules\DentalManagement\Domain\Services\PatientQuestionService;

final readonly class UpdatePatientQuestionUseCase
{
    public function __construct(private PatientQuestionService $patientQuestionService) {}

    public function execute(int $id, PatientQuestionData $patientQuestionData): PatientQuestion
    {
        return $this->patientQuestionService->updatePatientQuestion($id, $patientQuestionData->toArray());
    }
}
