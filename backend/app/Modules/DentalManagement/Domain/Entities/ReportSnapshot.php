<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Modules\Common\Domain\Entities\Concerns\HasUserStamps;

final class ReportSnapshot extends Model
{
    use HasUserStamps;
    protected $fillable = [
        'user_id',
        'report_key',
        'reason',
        'filters',
        'payload',
        'captured_at',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'filters' => 'array',
            'payload' => 'array',
            'captured_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}