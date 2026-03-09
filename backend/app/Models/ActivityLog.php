<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
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
}
