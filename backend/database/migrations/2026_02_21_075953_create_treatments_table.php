<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SORTABLE_COLUMNS = [
        'id',
        'name',
        'category',
        'created_at',
    ];

    private const FRONTEND_FILTERS = [
        'enabled' => [1 => 'Active', 0 => 'Inactive'],
        'trashed' => ['with', 'only'],
    ];

    private const SEARCHABLE_COLUMNS = [
        'name' => 'name',
        'category' => 'category',
        'description' => 'description',
    ];

    private const FIELDABLE_COLUMNS = [
        'id' => 'id',
        'name' => 'name',
        'category' => 'category',
        'defaultPrice' => 'default_price',
        'durationMinutes' => 'duration_minutes',
        'description' => 'description',
        'enabled' => 'enabled',
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
        Schema::create('treatments', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('category');
            $table->decimal('default_price', 10, 2);
            $table->integer('duration_minutes')->nullable();
            $table->text('description')->nullable();
            $table->boolean('enabled')->default(true);
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
        Schema::dropIfExists('treatments');
    }
};
