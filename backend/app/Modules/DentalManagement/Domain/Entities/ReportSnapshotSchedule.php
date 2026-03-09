<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class ReportSnapshotSchedule extends Model
{
    protected $fillable = [
        'user_id',
        'report_key',
        'cadence',
        'filters',
        'last_run_at',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'filters' => 'array',
            'last_run_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
