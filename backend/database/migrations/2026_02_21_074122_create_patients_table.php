<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SORTABLE_COLUMNS = [
        'id',
        'patient_code',
        'first_name',
        'created_at',
    ];

    private const FRONTEND_FILTERS = [
        'gender' => ['male', 'female'],
        'status' => ['pending', 'approved', 'rejected'],
        'enabled' => [1 => 'Active', 0 => 'Inactive'],
        'trashed' => ['with', 'only'],
    ];

    private const SEARCHABLE_COLUMNS = [
        'patientCode' => 'patient_code',
        'firstName' => 'first_name',
        'lastName' => 'last_name',
        'contactNumber' => 'contact_number',
        'email' => 'email',
        'address' => 'address',
        'bloodGroup' => 'blood_group',
        'emergencyContact' => 'emergency_contact',
    ];

    private const FIELDABLE_COLUMNS = [
        'id' => 'id',
        'patientCode' => 'patient_code',
        'firstName' => 'first_name',
        'lastName' => 'last_name',
        'gender' => 'gender',
        'dateOfBirth' => 'date_of_birth',
        'contactNumber' => 'contact_number',
        'email' => 'email',
        'address' => 'address',
        'bloodGroup' => 'blood_group',
        'emergencyContact' => 'emergency_contact',
        'enabled' => 'enabled',
        'status' => 'status',
        'remarks' => 'remarks',
        'createdBy' => 'created_by',
        'updatedBy' => 'updated_by',
        'deletedBy' => 'deleted_by',
        'createdAt' => 'created_at',
        'updatedAt' => 'updated_at',
        'deletedAt' => 'deleted_at',
    ];

    private const BOOLEAN_FIELDS = [
        'enabled',
    ];

    private const CAST_IDS = [
        'createdBy',
        'updatedBy',
        'deletedBy',
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->string('patient_code')->unique();
            $table->string('first_name');
            $table->string('last_name')->nullable();
            $table->enum('gender', ['male', 'female'])->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('contact_number')->nullable();
            $table->string('email')->nullable()->unique();
            $table->text('address')->nullable();
            $table->string('blood_group')->nullable();
            $table->string('emergency_contact')->nullable();
            $table->boolean('enabled')->default(true);
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('remarks')->nullable();
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
        Schema::dropIfExists('patients');
    }
};
