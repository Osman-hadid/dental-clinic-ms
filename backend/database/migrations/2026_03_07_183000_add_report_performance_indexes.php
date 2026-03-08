<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table): void {
            if (!Schema::hasIndex('appointments', 'appointments_date_status_idx')) {
                $table->index(['appointment_date', 'status'], 'appointments_date_status_idx');
            }
            if (!Schema::hasIndex('appointments', 'appointments_dentist_date_idx')) {
                $table->index(['dentist_id', 'appointment_date'], 'appointments_dentist_date_idx');
            }
            if (!Schema::hasIndex('appointments', 'appointments_patient_date_idx')) {
                $table->index(['patient_id', 'appointment_date'], 'appointments_patient_date_idx');
            }
        });

        Schema::table('visits', function (Blueprint $table): void {
            if (!Schema::hasIndex('visits', 'visits_date_idx')) {
                $table->index('visit_date', 'visits_date_idx');
            }
            if (!Schema::hasIndex('visits', 'visits_dentist_date_idx')) {
                $table->index(['dentist_id', 'visit_date'], 'visits_dentist_date_idx');
            }
            if (!Schema::hasIndex('visits', 'visits_patient_date_idx')) {
                $table->index(['patient_id', 'visit_date'], 'visits_patient_date_idx');
            }
        });

        Schema::table('invoices', function (Blueprint $table): void {
            if (!Schema::hasIndex('invoices', 'invoices_date_status_idx')) {
                $table->index(['invoice_date', 'status'], 'invoices_date_status_idx');
            }
            if (!Schema::hasIndex('invoices', 'invoices_patient_date_idx')) {
                $table->index(['patient_id', 'invoice_date'], 'invoices_patient_date_idx');
            }
            if (!Schema::hasIndex('invoices', 'invoices_visit_date_idx')) {
                $table->index(['visit_id', 'invoice_date'], 'invoices_visit_date_idx');
            }
        });

        Schema::table('payments', function (Blueprint $table): void {
            if (!Schema::hasIndex('payments', 'payments_date_method_idx')) {
                $table->index(['payment_date', 'method'], 'payments_date_method_idx');
            }
            if (!Schema::hasIndex('payments', 'payments_invoice_date_idx')) {
                $table->index(['invoice_id', 'payment_date'], 'payments_invoice_date_idx');
            }
        });

        Schema::table('expenses', function (Blueprint $table): void {
            if (!Schema::hasIndex('expenses', 'expenses_staff_date_idx')) {
                $table->index(['staff_id', 'expense_date'], 'expenses_staff_date_idx');
            }
        });

        Schema::table('safe_transactions', function (Blueprint $table): void {
            if (!Schema::hasIndex('safe_transactions', 'safe_transactions_staff_date_idx')) {
                $table->index(['picked_by_staff_id', 'transaction_date'], 'safe_transactions_staff_date_idx');
            }
        });

        Schema::table('salary_payments', function (Blueprint $table): void {
            if (!Schema::hasIndex('salary_payments', 'salary_payments_date_status_idx')) {
                $table->index(['payment_date', 'status'], 'salary_payments_date_status_idx');
            }
        });

        Schema::table('shareholder_transactions', function (Blueprint $table): void {
            if (!Schema::hasIndex('shareholder_transactions', 'shareholder_transactions_date_idx')) {
                $table->index('transaction_date', 'shareholder_transactions_date_idx');
            }
        });

        Schema::table('patient_session_tasks', function (Blueprint $table): void {
            if (!Schema::hasIndex('patient_session_tasks', 'patient_session_tasks_patient_created_idx')) {
                $table->index(['patient_id', 'created_at'], 'patient_session_tasks_patient_created_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('patient_session_tasks', function (Blueprint $table): void {
            if (Schema::hasIndex('patient_session_tasks', 'patient_session_tasks_patient_created_idx')) {
                $table->dropIndex('patient_session_tasks_patient_created_idx');
            }
        });

        Schema::table('shareholder_transactions', function (Blueprint $table): void {
            if (Schema::hasIndex('shareholder_transactions', 'shareholder_transactions_date_idx')) {
                $table->dropIndex('shareholder_transactions_date_idx');
            }
        });

        Schema::table('salary_payments', function (Blueprint $table): void {
            if (Schema::hasIndex('salary_payments', 'salary_payments_date_status_idx')) {
                $table->dropIndex('salary_payments_date_status_idx');
            }
        });

        Schema::table('safe_transactions', function (Blueprint $table): void {
            if (Schema::hasIndex('safe_transactions', 'safe_transactions_staff_date_idx')) {
                $table->dropIndex('safe_transactions_staff_date_idx');
            }
        });

        Schema::table('expenses', function (Blueprint $table): void {
            if (Schema::hasIndex('expenses', 'expenses_staff_date_idx')) {
                $table->dropIndex('expenses_staff_date_idx');
            }
        });

        Schema::table('payments', function (Blueprint $table): void {
            if (Schema::hasIndex('payments', 'payments_invoice_date_idx')) {
                $table->dropIndex('payments_invoice_date_idx');
            }
            if (Schema::hasIndex('payments', 'payments_date_method_idx')) {
                $table->dropIndex('payments_date_method_idx');
            }
        });

        Schema::table('invoices', function (Blueprint $table): void {
            if (Schema::hasIndex('invoices', 'invoices_visit_date_idx')) {
                $table->dropIndex('invoices_visit_date_idx');
            }
            if (Schema::hasIndex('invoices', 'invoices_patient_date_idx')) {
                $table->dropIndex('invoices_patient_date_idx');
            }
            if (Schema::hasIndex('invoices', 'invoices_date_status_idx')) {
                $table->dropIndex('invoices_date_status_idx');
            }
        });

        Schema::table('visits', function (Blueprint $table): void {
            if (Schema::hasIndex('visits', 'visits_patient_date_idx')) {
                $table->dropIndex('visits_patient_date_idx');
            }
            if (Schema::hasIndex('visits', 'visits_dentist_date_idx')) {
                $table->dropIndex('visits_dentist_date_idx');
            }
            if (Schema::hasIndex('visits', 'visits_date_idx')) {
                $table->dropIndex('visits_date_idx');
            }
        });

        Schema::table('appointments', function (Blueprint $table): void {
            if (Schema::hasIndex('appointments', 'appointments_patient_date_idx')) {
                $table->dropIndex('appointments_patient_date_idx');
            }
            if (Schema::hasIndex('appointments', 'appointments_dentist_date_idx')) {
                $table->dropIndex('appointments_dentist_date_idx');
            }
            if (Schema::hasIndex('appointments', 'appointments_date_status_idx')) {
                $table->dropIndex('appointments_date_status_idx');
            }
        });
    }
};
