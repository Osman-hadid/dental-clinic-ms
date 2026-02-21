<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Tooth;

use App\Modules\Common\Infrastructure\Http\Requests\BulkDeleteRequest;

final class BulkDeleteTeethRequest extends BulkDeleteRequest
{
    protected function tableName(): string
    {
        return 'teeth';
    }

    protected function entityName(): string
    {
        return 'Tooth';
    }

    public function authorize(): bool
    {
        return true;
    }
}
