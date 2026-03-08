<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Application\DTOs\PatientQuestionData;
use App\Modules\DentalManagement\Application\UseCases\PatientQuestion\CreatePatientQuestionUseCase;
use App\Modules\DentalManagement\Application\UseCases\PatientQuestion\DeletePatientQuestionUseCase;
use App\Modules\DentalManagement\Application\UseCases\PatientQuestion\GetPatientQuestionUseCase;
use App\Modules\DentalManagement\Application\UseCases\PatientQuestion\ListPatientQuestionsUseCase;
use App\Modules\DentalManagement\Application\UseCases\PatientQuestion\UpdatePatientQuestionUseCase;
use App\Modules\DentalManagement\Domain\Entities\PatientQuestion;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\PatientQuestion\ListPatientQuestionsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\PatientQuestion\StorePatientQuestionRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\PatientQuestion\UpdatePatientQuestionRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\PatientQuestionResource;
use Illuminate\Http\JsonResponse;

final class PatientQuestionController extends BaseApiController
{
    public function __construct(
        private readonly ListPatientQuestionsUseCase $listPatientQuestionsUseCase,
        private readonly GetPatientQuestionUseCase $getPatientQuestionUseCase,
        private readonly CreatePatientQuestionUseCase $createPatientQuestionUseCase,
        private readonly UpdatePatientQuestionUseCase $updatePatientQuestionUseCase,
        private readonly DeletePatientQuestionUseCase $deletePatientQuestionUseCase,
    ) {}

    public function index(ListPatientQuestionsRequest $listPatientQuestionsRequest): JsonResponse
    {
        $this->authorize('viewAny', PatientQuestion::class);

        $querySpecification = QuerySpecification::fromArray($listPatientQuestionsRequest->validated());
        $lengthAwarePaginator = $this->listPatientQuestionsUseCase->execute($querySpecification);
        $paginatedResource = new PaginatedResource($lengthAwarePaginator, PatientQuestionResource::class);

        return $this->successResponse(
            data: $paginatedResource,
            message: __('DentalManagement::messages.patient_questions.fetched')
        );
    }

    public function store(StorePatientQuestionRequest $storePatientQuestionRequest): JsonResponse
    {
        $this->authorize('create', PatientQuestion::class);

        $patientQuestion = $this->createPatientQuestionUseCase->execute(
            PatientQuestionData::fromArray($storePatientQuestionRequest->validated())
        );

        return $this->successResponse(
            data: new PatientQuestionResource($patientQuestion),
            message: __('DentalManagement::messages.patient_question.created'),
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $patientQuestion = $this->getPatientQuestionUseCase->execute($id);
        $this->authorize('view', $patientQuestion);

        return $this->successResponse(
            data: new PatientQuestionResource($patientQuestion),
            message: __('DentalManagement::messages.patient_question.fetched')
        );
    }

    public function update(UpdatePatientQuestionRequest $updatePatientQuestionRequest, int $id): JsonResponse
    {
        $patientQuestion = $this->updatePatientQuestionUseCase->execute(
            $id,
            PatientQuestionData::fromArray($updatePatientQuestionRequest->validated())
        );
        $this->authorize('update', $patientQuestion);

        return $this->successResponse(
            data: new PatientQuestionResource($patientQuestion),
            message: __('DentalManagement::messages.patient_question.updated')
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $this->authorize('delete', PatientQuestion::class);

        $this->deletePatientQuestionUseCase->execute($id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.patient_question.deleted')
        );
    }
}
