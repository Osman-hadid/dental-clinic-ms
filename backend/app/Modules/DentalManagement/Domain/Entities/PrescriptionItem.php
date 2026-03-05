<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class PrescriptionItem extends Model
{
    protected $fillable = [
        'prescription_id',
        'name',
        'unit',
        'amount',
        'frequency',
        'food_timing',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'prescription_id' => 'integer',
            'created_by' => 'integer',
            'updated_by' => 'integer',
            'deleted_by' => 'integer',
        ];
    }

    public function prescription(): BelongsTo
    {
        return $this->belongsTo(Prescription::class);
    }
}

