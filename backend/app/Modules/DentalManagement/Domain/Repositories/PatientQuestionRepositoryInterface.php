<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Repositories;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\PatientQuestion;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface PatientQuestionRepositoryInterface
{
    public function paginate(QuerySpecification $querySpecification): LengthAwarePaginator;

    public function find(int $id): PatientQuestion;

    public function create(array $data): PatientQuestion;

    public function update(int $id, array $data): PatientQuestion;

    public function delete(int $id): void;

    public function invalidateCache(): void;
}
