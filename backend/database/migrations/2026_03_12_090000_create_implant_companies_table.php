<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('implant_companies', function (Blueprint $table): void {
            $table->id();
            $table->string('company_name', 160);
            $table->string('implant_type', 160);
            $table->date('record_date')->nullable();
            $table->text('note')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            $table->unique(['company_name', 'implant_type'], 'implant_companies_company_type_unique');
            $table->index('company_name', 'implant_companies_company_name_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('implant_companies');
    }
};
