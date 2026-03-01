<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class DentalBackup extends Model
{
    protected $fillable = [
        'mode',
        'frequency',
        'start_date',
        'end_date',
        'status',
        'file_path',
        'file_size_bytes',
        'summary',
        'notes',
        'triggered_by',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'summary' => 'array',
            'file_size_bytes' => 'integer',
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
            'completed_at' => 'datetime',
            'triggered_by' => 'integer',
        ];
    }

    public function triggeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'triggered_by');
    }
}
