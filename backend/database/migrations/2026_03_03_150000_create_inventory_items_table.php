<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_items', function (Blueprint $table): void {
            $table->id();
            $table->enum('acquisition_source', ['previous_stock', 'purchase'])->default('previous_stock');
            $table->date('entry_date');
            $table->string('item_name', 160);
            $table->enum('category', ['consumable', 'medicine', 'instrument', 'implant', 'ppe', 'other']);
            $table->unsignedInteger('quantity')->default(0);
            $table->enum('unit', ['piece', 'box', 'pack', 'bottle', 'tube', 'set', 'kit', 'pair', 'unit'])->default('piece');
            $table->unsignedInteger('min_stock')->default(0);
            $table->decimal('unit_cost', 12, 2)->default(0);
            $table->decimal('total_cost', 12, 2)->default(0);
            $table->string('supplier', 160)->nullable();
            $table->string('lot_number', 120)->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('location', 160)->nullable();
            $table->string('notes', 255)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->unsignedBigInteger('deleted_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['entry_date']);
            $table->index(['acquisition_source']);
            $table->index(['category']);
            $table->index(['expiry_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_items');
    }
};

