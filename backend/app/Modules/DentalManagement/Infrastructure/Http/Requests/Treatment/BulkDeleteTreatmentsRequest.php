<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Treatment;

use App\Modules\Common\Infrastructure\Http\Requests\BulkDeleteRequest;

final class BulkDeleteTreatmentsRequest extends BulkDeleteRequest
{
    protected function tableName(): string
    {
        return 'treatments';
    }

    protected function entityName(): string
    {
        return 'Treatment';
    }

    public function authorize(): bool
    {
        return true;
    }
}
