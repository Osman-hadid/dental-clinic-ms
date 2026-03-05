<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

final class Prescription extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'visit_treatment_id',
        'visit_id',
        'patient_id',
        'dentist_id',
        'content',
        'medicine_name',
        'dosage_unit',
        'dosage_amount',
        'frequency',
        'food_timing',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'visit_treatment_id' => 'integer',
            'visit_id' => 'integer',
            'patient_id' => 'integer',
            'dentist_id' => 'integer',
            'created_by' => 'integer',
            'updated_by' => 'integer',
            'deleted_by' => 'integer',
            'medicine_name' => 'string',
            'dosage_unit' => 'string',
            'dosage_amount' => 'string',
            'frequency' => 'string',
            'food_timing' => 'string',
        ];
    }

    public function visitTreatment(): BelongsTo
    {
        return $this->belongsTo(VisitTreatment::class);
    }

    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function dentist(): BelongsTo
    {
        return $this->belongsTo(Staff::class, 'dentist_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PrescriptionItem::class);
    }
}
