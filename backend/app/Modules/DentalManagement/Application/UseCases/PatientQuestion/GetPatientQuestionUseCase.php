<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\PatientQuestion;

use App\Modules\DentalManagement\Domain\Entities\PatientQuestion;
use App\Modules\DentalManagement\Domain\Services\PatientQuestionService;

final readonly class GetPatientQuestionUseCase
{
    public function __construct(private PatientQuestionService $patientQuestionService) {}

    public function execute(int $id): PatientQuestion
    {
        return $this->patientQuestionService->getPatientQuestion($id);
    }
}
