<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shareholders', function (Blueprint $table): void {
            $table->id();
            $table->string('full_name', 160);
            $table->string('contact_number', 40)->nullable();
            $table->string('email', 160)->nullable();
            $table->string('address', 255)->nullable();
            $table->decimal('ownership_percentage', 5, 2)->default(0);
            $table->decimal('initial_capital', 14, 2)->default(0);
            $table->decimal('initial_capital_input', 14, 2)->default(0);
            $table->string('currency', 3)->default('AFN');
            $table->decimal('exchange_rate', 14, 6)->default(1);
            $table->date('joined_date')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->string('notes', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('full_name', 'shareholders_full_name_idx');
            $table->index('status', 'shareholders_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shareholders');
    }
};
