<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SORTABLE_COLUMNS = [
        'id',
        'price',
        'created_at',
    ];

    private const FRONTEND_FILTERS = [
        'trashed' => ['with', 'only'],
    ];

    private const SEARCHABLE_COLUMNS = [
        'notes' => 'notes',
    ];

    private const FIELDABLE_COLUMNS = [
        'id' => 'id',
        'visitId' => 'visit_id',
        'treatmentId' => 'treatment_id',
        'toothId' => 'tooth_id',
        'dentistId' => 'dentist_id',
        'price' => 'price',
        'notes' => 'notes',
        'createdBy' => 'created_by',
        'updatedBy' => 'updated_by',
        'deletedBy' => 'deleted_by',
        'createdAt' => 'created_at',
        'updatedAt' => 'updated_at',
        'deletedAt' => 'deleted_at',
    ];

    private const CAST_IDS = [
        'visitId',
        'treatmentId',
        'toothId',
        'dentistId',
        'createdBy',
        'updatedBy',
        'deletedBy',
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('visit_treatments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_id')->constrained('visits')->cascadeOnDelete();
            $table->foreignId('treatment_id')->constrained('treatments');
            $table->foreignId('tooth_id')->nullable()->constrained('teeth');
            $table->foreignId('dentist_id')->constrained('staff');
            $table->decimal('price', 10, 2);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->unsignedBigInteger('deleted_by')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('visit_treatments');
    }
};
