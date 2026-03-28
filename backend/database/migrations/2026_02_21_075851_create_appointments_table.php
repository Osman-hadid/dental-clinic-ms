<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SORTABLE_COLUMNS = [
        'id',
        'appointment_date',
        'start_time',
        'status',
        'created_at',
    ];

    private const FRONTEND_FILTERS = [
        'status' => ['scheduled', 'checked_in', 'waiting', 'in_chair', 'completed', 'cancelled'],
        'trashed' => ['with', 'only'],
    ];

    private const SEARCHABLE_COLUMNS = [
        'notes' => 'notes',
    ];

    private const FIELDABLE_COLUMNS = [
        'id' => 'id',
        'patientId' => 'patient_id',
        'dentistId' => 'dentist_id',
        'appointmentDate' => 'appointment_date',
        'startTime' => 'start_time',
        'endTime' => 'end_time',
        'status' => 'status',
        'notes' => 'notes',
        'createdBy' => 'created_by',
        'updatedBy' => 'updated_by',
        'deletedBy' => 'deleted_by',
        'createdAt' => 'created_at',
        'updatedAt' => 'updated_at',
        'deletedAt' => 'deleted_at',
    ];

    private const CAST_IDS = [
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
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->foreignId('dentist_id')->constrained('staff');
            $table->date('appointment_date');
            $table->time('start_time');
            $table->time('end_time')->nullable();
            $table->enum('status', ['scheduled', 'checked_in', 'waiting', 'in_chair', 'completed', 'cancelled'])->default('scheduled');
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
        Schema::dropIfExists('appointments');
    }
};
