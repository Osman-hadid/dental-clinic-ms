<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patient_session_tasks', function (Blueprint $table): void {
            $table->foreignId('implant_company_id')
                ->nullable()
                ->after('patient_id')
                ->constrained('implant_companies')
                ->nullOnDelete();
            $table->index('implant_company_id', 'patient_session_tasks_implant_company_idx');
        });
    }

    public function down(): void
    {
        Schema::table('patient_session_tasks', function (Blueprint $table): void {
            if (Schema::hasColumn('patient_session_tasks', 'implant_company_id')) {
                $table->dropForeign(['implant_company_id']);
                $table->dropIndex('patient_session_tasks_implant_company_idx');
                $table->dropColumn('implant_company_id');
            }
        });
    }
};
