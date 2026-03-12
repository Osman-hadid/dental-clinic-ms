<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Modules\Common\Domain\Entities\Concerns\HasUserStamps;

final class DentalBackupSchedule extends Model
{
    use HasUserStamps;
    protected $fillable = [
        'frequency',
        'run_at_time',
        'run_day_of_week',
        'run_day_of_month',
        'run_month',
        'is_active',
        'last_run_at',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'run_day_of_week' => 'integer',
            'run_day_of_month' => 'integer',
            'run_month' => 'integer',
            'is_active' => 'boolean',
            'last_run_at' => 'datetime',
            'updated_by' => 'integer',
        ];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}