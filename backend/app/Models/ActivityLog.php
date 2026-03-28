<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\Prunable;

class ActivityLog extends Model
{
    use Prunable;

    protected $table = 'activity_log';

    protected function casts(): array
    {
        return [
            'properties' => 'array',
        ];
    }

    public function prunable()
    {
        return static::where('created_at', '<', now()->subDays(90));
    }

    public function causer(): MorphTo
    {
        return $this->morphTo();
    }

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }
}
