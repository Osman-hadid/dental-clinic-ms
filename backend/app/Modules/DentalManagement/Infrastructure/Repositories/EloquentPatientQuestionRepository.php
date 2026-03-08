<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Repositories;

use App\Modules\Common\Infrastructure\Repositories\BaseEloquentRepository;
use App\Modules\DentalManagement\Domain\Entities\PatientQuestion;
use App\Modules\DentalManagement\Domain\Repositories\PatientQuestionRepositoryInterface;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\PatientQuestion\ListPatientQuestionsRequest;
use Spatie\QueryBuilder\QueryBuilder;

final class EloquentPatientQuestionRepository extends BaseEloquentRepository implements PatientQuestionRepositoryInterface
{
    protected string $model = PatientQuestion::class;

    protected string $requestClass = ListPatientQuestionsRequest::class;

    public function find(int $id): PatientQuestion
    {
        return QueryBuilder::for($this->model)
            ->allowedFields($this->getAllowedFields())
            ->findOrFail($id);
    }

    public function create(array $data): PatientQuestion
    {
        return PatientQuestion::create($data);
    }

    public function update(int $id, array $data): PatientQuestion
    {
        $patientQuestion = $this->find($id);
        $patientQuestion->update($data);

        return $patientQuestion;
    }

    public function delete(int $id): void
    {
        $this->find($id)->delete();
    }

    private function getAllowedFields(): array
    {
        $fields = request()->input('fields');
        if (!$fields) {
            return [];
        }

        $allowed = array_keys($this->requestClass::getFieldableColumns());
        $requested = array_filter(explode(',', (string) $fields));

        return array_intersect($requested, $allowed);
    }
}
