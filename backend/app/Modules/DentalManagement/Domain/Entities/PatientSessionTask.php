<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Modules\Common\Domain\Entities\Concerns\HasUserStamps;
use App\Modules\DentalManagement\Domain\Entities\ImplantCompany;

final class PatientSessionTask extends Model
{
    use HasUserStamps;
    protected $fillable = [
        'patient_id',
        'implant_company_id',
        'title',
        'mark',
        'status',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'implant_company_id' => 'integer',
            'created_by' => 'integer',
            'updated_by' => 'integer',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function implantCompany(): BelongsTo
    {
        return $this->belongsTo(ImplantCompany::class);
    }
}
