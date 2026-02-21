<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SORTABLE_COLUMNS = [
        'id',
        'name_en',
        'created_at',
    ];

    private const SEARCHABLE_COLUMNS = [
        'name' => ['name_en', 'name_ps', 'name_dr'],
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('modules', function (Blueprint $table) {
            $table->id();
            $table->string('name_en');
            $table->string('name_ps')->nullable();
            $table->string('name_dr')->nullable();
            $table->string('url');
            $table->string('description')->nullable();
            $table->integer('sort_order')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('modules');
    }
};
