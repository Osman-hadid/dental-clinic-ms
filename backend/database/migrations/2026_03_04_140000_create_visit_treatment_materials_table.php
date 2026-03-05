<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visit_treatment_materials', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('visit_treatment_id')->constrained('visit_treatments')->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->nullable()->constrained('inventory_items')->nullOnDelete();
            $table->string('item_name', 160);
            $table->string('unit', 30)->default('unit');
            $table->unsignedInteger('quantity_used')->default(1);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->unsignedBigInteger('deleted_by')->nullable();
            $table->timestamps();

            $table->unique(['visit_treatment_id', 'inventory_item_id']);
            $table->index(['visit_treatment_id']);
            $table->index(['inventory_item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visit_treatment_materials');
    }
};

