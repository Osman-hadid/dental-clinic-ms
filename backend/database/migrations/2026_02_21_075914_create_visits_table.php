<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SORTABLE_COLUMNS = [
        'id',
        'visit_date',
        'created_at',
    ];

    private const FRONTEND_FILTERS = [
        'trashed' => ['with', 'only'],
    ];

    private const SEARCHABLE_COLUMNS = [
        'diagnosisNotes' => 'diagnosis_notes',
    ];

    private const FIELDABLE_COLUMNS = [
        'id' => 'id',
        'appointmentId' => 'appointment_id',
        'patientId' => 'patient_id',
        'dentistId' => 'dentist_id',
        'visitDate' => 'visit_date',
        'diagnosisNotes' => 'diagnosis_notes',
        'nextVisitDate' => 'next_visit_date',
        'createdBy' => 'created_by',
        'updatedBy' => 'updated_by',
        'deletedBy' => 'deleted_by',
        'createdAt' => 'created_at',
        'updatedAt' => 'updated_at',
        'deletedAt' => 'deleted_at',
    ];

    private const CAST_IDS = [
        'appointmentId',
        'patientId',
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
        Schema::create('visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('appointment_id')->constrained('appointments')->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->foreignId('dentist_id')->constrained('staff');
            $table->date('visit_date');
            $table->text('diagnosis_notes')->nullable();
            $table->date('next_visit_date')->nullable();
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
        Schema::dropIfExists('visits');
    }
};
