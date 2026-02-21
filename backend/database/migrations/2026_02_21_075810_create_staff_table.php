<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SORTABLE_COLUMNS = [
        'id',
        'full_name',
        'role',
        'created_at',
    ];

    private const FRONTEND_FILTERS = [
        'role' => ['dentist', 'assistant', 'reception', 'admin'],
        'enabled' => [1 => 'Active', 0 => 'Inactive'],
        'trashed' => ['with', 'only'],
    ];

    private const SEARCHABLE_COLUMNS = [
        'fullName' => 'full_name',
        'specialization' => 'specialization',
        'contactNumber' => 'contact_number',
        'email' => 'email',
    ];

    private const FIELDABLE_COLUMNS = [
        'id' => 'id',
        'fullName' => 'full_name',
        'role' => 'role',
        'specialization' => 'specialization',
        'contactNumber' => 'contact_number',
        'email' => 'email',
        'hireDate' => 'hire_date',
        'enabled' => 'enabled',
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
        Schema::create('staff', function (Blueprint $table) {
            $table->id();
            $table->string('full_name');
            $table->enum('role', ['dentist', 'assistant', 'reception', 'admin']);
            $table->string('specialization')->nullable();
            $table->string('contact_number')->nullable()->unique();
            $table->string('email')->nullable()->unique();
            $table->date('hire_date')->nullable();
            $table->boolean('enabled')->default(true);
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
        Schema::dropIfExists('staff');
    }
};
