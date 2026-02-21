<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Visit;

use App\Modules\Common\Infrastructure\Http\Requests\BulkDeleteRequest;

final class BulkDeleteVisitsRequest extends BulkDeleteRequest
{
    protected function tableName(): string
    {
        return 'visits';
    }

    protected function entityName(): string
    {
        return 'Visit';
    }

    public function authorize(): bool
    {
        return true;
    }
}
