<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Patient;

use App\Modules\Common\Infrastructure\Http\Requests\BulkDeleteRequest;

final class BulkDeletePatientsRequest extends BulkDeleteRequest
{
    protected function tableName(): string
    {
        return 'patients';
    }

    protected function entityName(): string
    {
        return 'Patient';
    }

    public function authorize(): bool
    {
        return true;
    }
}
