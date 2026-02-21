<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Staff;

use App\Modules\Common\Infrastructure\Http\Requests\BulkDeleteRequest;

final class BulkDeleteStaffRequest extends BulkDeleteRequest
{
    protected function tableName(): string
    {
        return 'staff';
    }

    protected function entityName(): string
    {
        return 'Staff';
    }

    public function authorize(): bool
    {
        return true;
    }
}
