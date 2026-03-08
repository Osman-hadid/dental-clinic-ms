<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\PatientQuestion;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Services\PatientQuestionService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class ListPatientQuestionsUseCase
{
    public function __construct(private PatientQuestionService $patientQuestionService) {}

    public function execute(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->patientQuestionService->listPatientQuestions($querySpecification);
    }
}
