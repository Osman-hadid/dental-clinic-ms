<?php

declare(strict_types=1);

namespace App\Modules\Settings\Infrastructure\Http\Requests\Module;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;

final class ListModulesRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'name_en',
            'created_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [];
    }

    protected static function filters(): array
    {
        return [];
    }

    protected static function searchableColumns(): array
    {
        return [
            'name' => [
                'name_en',
                'name_ps',
                'name_dr',
            ],
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [];
    }
}
