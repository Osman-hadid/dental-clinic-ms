<?php

declare(strict_types=1);

namespace App\Modules\Settings\Infrastructure\Http\Requests\Module;

use App\Modules\Common\Infrastructure\Http\Requests\BulkDeleteRequest;

final class BulkDeleteModulesRequest extends BulkDeleteRequest
{
    protected function tableName(): string
    {
        return 'modules';
    }

    protected function entityName(): string
    {
        return 'Module';
    }

    public function authorize(): bool
    {
        return true;
    }
}
