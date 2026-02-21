<?php

declare(strict_types=1);

namespace App\Modules\Common\Infrastructure\Traits;

use Illuminate\Support\Facades\App;

trait HasLocalizedFields
{
    public function getLocalizedValue(object $model, string $base): string
    {
        $locale = App::getLocale();

        $field = "{$base}_{$locale}";
        $fallback = "{$base}_en";

        return $model->$field
            ?? $model->$fallback
            ?? '';
    }
}
