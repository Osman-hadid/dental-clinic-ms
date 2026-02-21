<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\VisitTreatment;

use App\Modules\Common\Infrastructure\Http\Requests\BulkDeleteRequest;

final class BulkDeleteVisitTreatmentsRequest extends BulkDeleteRequest
{
    protected function tableName(): string
    {
        return 'visit_treatments';
    }

    protected function entityName(): string
    {
        return 'Visit Treatment';
    }

    public function authorize(): bool
    {
        return true;
    }
}
