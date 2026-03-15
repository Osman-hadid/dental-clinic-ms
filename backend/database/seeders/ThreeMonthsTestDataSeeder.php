<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use App\Modules\Common\Domain\Entities\FileUpload;
use App\Modules\DentalManagement\Domain\Entities\Appointment;
use App\Modules\DentalManagement\Domain\Entities\DentalBackup;
use App\Modules\DentalManagement\Domain\Entities\DentalBackupSchedule;
use App\Modules\DentalManagement\Domain\Entities\Expense;
use App\Modules\DentalManagement\Domain\Entities\FinancialSetting;
use App\Modules\DentalManagement\Domain\Entities\InventoryItem;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use App\Modules\DentalManagement\Domain\Entities\PatientSessionTask;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Domain\Entities\Prescription;
use App\Modules\DentalManagement\Domain\Entities\PrescriptionItem;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Domain\Entities\SalaryPayment;
use App\Modules\DentalManagement\Domain\Entities\Shareholder;
use App\Modules\DentalManagement\Domain\Entities\ShareholderTransaction;
use App\Modules\DentalManagement\Domain\Entities\Staff;
use App\Modules\DentalManagement\Domain\Entities\Tooth;
use App\Modules\DentalManagement\Domain\Entities\Treatment;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatmentMaterial;
use App\Modules\DentalManagement\Domain\Services\DebtService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

final class ThreeMonthsTestDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->ensureCoreSeeders();

        $start = now()->startOfMonth()->subMonthsNoOverflow(2)->startOfDay();
        $end = now()->endOfDay();
        $seed = now()->format('YmdHis').Str::lower(Str::random(4));
        $actor = (int) User::query()->where('email', 'superadmin@system.af')->value('id');
        $actor = $actor > 0 ? $actor : (int) User::query()->min('id');
        $adminId = (int) User::query()->where('email', 'admin@system.af')->value('id');
        $adminId = $adminId > 0 ? $adminId : $actor;

        $supportUsers = collect();
        for ($i = 1; $i <= 6; $i++) {
            $user = User::query()->create([
                'first_name' => 'Seed',
                'last_name' => "User {$i}",
                'job_title' => 'Dental Tester',
                'email' => "seed.user.{$seed}.{$i}@system.af",
                'email_verified_at' => now(),
                'contact_number' => $this->seedPhone('07', $seed, $i),
                'whatsapp_number' => $this->seedPhone('079', $seed, $i),
                'report_to_id' => $actor,
                'main_organization_id' => 1,
                'password' => Hash::make('SeedUser123!'),
                'locale' => ['en', 'dr', 'ps'][($i - 1) % 3],
                'rights' => $i <= 2 ? 'approval' : 'review',
                'notifications' => true,
                'enabled' => true,
                'status' => 'approved',
                'remarks' => '3-month automated seed user',
                'created_by' => $actor,
                'updated_by' => $actor,
            ]);
            $supportUsers->push($user);
        }

        if (Schema::hasTable('active_users')) {
            foreach ($supportUsers->take(4) as $user) {
                DB::table('active_users')->insert([
                    'user_id' => $user->id,
                    'url' => '/reports',
                    'last_activity' => now()->subMinutes(random_int(1, 120)),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        if (Schema::hasTable('file_uploads')) {
            foreach ($supportUsers->take(4) as $i => $user) {
                FileUpload::query()->create([
                    'user_id' => $user->id,
                    'path' => "uploads/seed/{$seed}/file-{$i}.pdf",
                    'original_name' => "seed-{$i}.pdf",
                    'mime_type' => 'application/pdf',
                    'module' => 'dental-management',
                    'size' => random_int(20_000, 200_000),
                ]);
            }
        }

        if (Schema::hasTable('financial_settings')) {
            FinancialSetting::query()->updateOrCreate(
                ['setting_key' => 'afn_per_usd'],
                ['setting_value' => '1']
            );
        }

        $staff = collect();
        $roles = [
            ['role' => 'dentist', 'count' => 4, 'spec' => ['General Dentistry', 'Orthodontics', 'Endodontics']],
            ['role' => 'assistant', 'count' => 3, 'spec' => ['Chairside']],
            ['role' => 'reception', 'count' => 2, 'spec' => ['Front Desk']],
            ['role' => 'admin', 'count' => 1, 'spec' => ['Clinic Admin']],
        ];
        $k = 1;
        foreach ($roles as $roleMeta) {
            for ($i = 1; $i <= $roleMeta['count']; $i++) {
                $staff->push(Staff::query()->create([
                    'full_name' => ucfirst($roleMeta['role'])." {$i} {$seed}",
                    'role' => $roleMeta['role'],
                    'specialization' => $roleMeta['spec'][array_rand($roleMeta['spec'])],
                    'contact_number' => $this->seedPhone('07', "staff{$seed}", $k),
                    'email' => strtolower("{$roleMeta['role']}.{$seed}.{$i}@clinic.test"),
                    'hire_date' => $this->randomDate($start->copy()->subYears(2), $start)->format('Y-m-d'),
                    'enabled' => true,
                    'remarks' => '3-month seed',
                    'created_by' => $actor,
                    'updated_by' => $actor,
                ]));
                $k++;
            }
        }
        $dentists = $staff->where('role', 'dentist')->values();

        $patients = collect();
        $patientCount = 1000;
        for ($i = 1; $i <= $patientCount; $i++) {
            $patients->push(Patient::query()->create([
                'patient_code' => 'PT-'.strtoupper(substr($seed, -6)).'-'.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'first_name' => "Patient {$i}",
                'last_name' => 'Seed',
                'gender' => $i % 2 === 0 ? 'female' : 'male',
                'date_of_birth' => $this->randomDate($start->copy()->subYears(60), $start->copy()->subYears(5))->format('Y-m-d'),
                'contact_number' => $this->seedPhone('07', "patient{$seed}", $i),
                'email' => $i % 8 === 0 ? null : "patient.{$seed}.{$i}@example.test",
                'address' => 'Kabul',
                'blood_group' => ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'][$i % 8],
                'emergency_contact' => $this->seedPhone('07', "em{$seed}", $i),
                'enabled' => true,
                'status' => $i % 12 === 0 ? 'pending' : 'approved',
                'remarks' => '3-month seed',
                'created_by' => $actor,
                'updated_by' => $actor,
            ]));
        }

        $teeth = collect();
        foreach ([1, 2, 3, 4] as $q) {
            for ($n = 1; $n <= 8; $n++) {
                $number = (string) ($q * 10 + $n);
                $teeth->push(Tooth::query()->firstOrCreate(
                    ['tooth_number' => $number],
                    ['description' => "FDI {$number}", 'created_by' => $actor, 'updated_by' => $actor]
                ));
            }
        }

        $catalog = [
            ['Dental Consultation', 'diagnostic', 500, 20],
            ['Dental Cleaning', 'preventive', 900, 35],
            ['Filling Composite', 'restorative', 1400, 45],
            ['Root Canal', 'endodontic', 4800, 90],
            ['Tooth Extraction', 'surgical', 2200, 60],
            ['Crown Preparation', 'prosthodontic', 5200, 80],
            ['Whitening Session', 'cosmetic', 2500, 60],
        ];
        foreach ($catalog as $item) {
            Treatment::query()->updateOrCreate(
                ['name' => $item[0]],
                [
                    'category' => $item[1],
                    'default_price' => $item[2],
                    'duration_minutes' => $item[3],
                    'description' => '3-month seed',
                    'enabled' => true,
                    'created_by' => $actor,
                    'updated_by' => $actor,
                ]
            );
        }
        $treatments = Treatment::query()->whereIn('name', array_map(fn ($x) => $x[0], $catalog))->get();

        $inventory = collect();
        $categories = ['consumable', 'medicine', 'instrument', 'implant', 'ppe', 'other'];
        $units = ['piece', 'box', 'pack', 'bottle', 'tube', 'set', 'kit', 'pair', 'unit'];
        for ($i = 1; $i <= 30; $i++) {
            $qty = random_int(20, 220);
            $cost = (float) random_int(30, 900);
            $inventory->push(InventoryItem::query()->create([
                'acquisition_source' => $i % 3 === 0 ? 'purchase' : 'previous_stock',
                'entry_date' => $this->randomDate($start, $end)->format('Y-m-d'),
                'item_name' => "Item {$i}",
                'category' => $categories[array_rand($categories)],
                'quantity' => $qty,
                'unit' => $units[array_rand($units)],
                'min_stock' => random_int(5, 25),
                'unit_cost' => $cost,
                'total_cost' => round($qty * $cost, 2),
                'supplier' => "Supplier {$i}",
                'lot_number' => "LOT-{$seed}-{$i}",
                'expiry_date' => $this->randomDate($end->copy()->addMonth(), $end->copy()->addYear())->format('Y-m-d'),
                'location' => 'Main Store',
                'notes' => '3-month seed',
                'created_by' => $actor,
                'updated_by' => $actor,
            ]));
        }

        $appointments = collect();
        $visits = collect();
        $apNo = 1;
        $visNo = 1;
        for ($d = $start->copy(); $d->lte($end); $d->addDay()) {
            $perDay = random_int(2, 5);
            for ($i = 1; $i <= $perDay; $i++) {
                $status = $d->gte($end->copy()->subDays(2))
                    ? $this->weighted(['scheduled' => 45, 'completed' => 45, 'cancelled' => 10])
                    : $this->weighted(['completed' => 75, 'scheduled' => 15, 'cancelled' => 10]);
                $hh = random_int(8, 16);
                $mm = [0, 30][array_rand([0, 1])];
                $st = sprintf('%02d:%02d:00', $hh, $mm);
                $en = Carbon::createFromTime($hh, $mm)->addMinutes([30, 45, 60][array_rand([30, 45, 60])])->format('H:i:s');
                $appointment = Appointment::query()->create([
                    'patient_id' => $patients->random()->id,
                    'dentist_id' => $dentists->random()->id,
                    'tag' => 'APT-'.str_pad((string) $apNo, 6, '0', STR_PAD_LEFT),
                    'appointment_date' => $d->format('Y-m-d'),
                    'start_time' => $st,
                    'end_time' => $en,
                    'status' => $status,
                    'notes' => '3-month seed',
                    'created_by' => $actor,
                    'updated_by' => $actor,
                ]);
                $appointments->push($appointment);
                $apNo++;

                if ($status === 'completed' && random_int(1, 100) <= 90) {
                    $visits->push(Visit::query()->create([
                        'appointment_id' => $appointment->id,
                        'patient_id' => $appointment->patient_id,
                        'dentist_id' => $appointment->dentist_id,
                        'tag' => 'VIS-'.str_pad((string) $visNo, 6, '0', STR_PAD_LEFT),
                        'visit_date' => $d->format('Y-m-d'),
                        'diagnosis_notes' => 'seed diagnosis',
                        'next_visit_date' => random_int(1, 100) <= 35 ? $d->copy()->addDays(random_int(7, 30))->format('Y-m-d') : null,
                        'created_by' => $actor,
                        'updated_by' => $actor,
                    ]));
                    $visNo++;
                }
            }
            if (random_int(1, 100) <= 20) {
                $visits->push(Visit::query()->create([
                    'appointment_id' => null,
                    'patient_id' => $patients->random()->id,
                    'dentist_id' => $dentists->random()->id,
                    'tag' => 'VIS-'.str_pad((string) $visNo, 6, '0', STR_PAD_LEFT),
                    'visit_date' => $d->format('Y-m-d'),
                    'diagnosis_notes' => 'walk-in seed',
                    'next_visit_date' => null,
                    'created_by' => $actor,
                    'updated_by' => $actor,
                ]));
                $visNo++;
            }
        }

        $visitTreatments = collect();
        $visitTotals = [];
        foreach ($visits as $visit) {
            for ($i = 1; $i <= random_int(1, 3); $i++) {
                $t = $treatments->random();
                $tooth = random_int(1, 100) <= 70 ? $teeth->random() : null;
                $price = round(max(1, (float) $t->default_price * (random_int(85, 130) / 100)), 2);
                $row = VisitTreatment::query()->create([
                    'visit_id' => $visit->id,
                    'treatment_id' => $t->id,
                    'tooth_id' => $tooth?->id,
                    'tooth_number' => $tooth?->tooth_number,
                    'dentist_id' => $visit->dentist_id,
                    'price' => $price,
                    'material' => 'seed materials',
                    'notes' => '3-month seed',
                    'created_by' => $actor,
                    'updated_by' => $actor,
                ]);
                $visitTreatments->push($row);
                $visitTotals[$visit->id] = round(($visitTotals[$visit->id] ?? 0) + $price, 2);
            }
        }

        $invoices = collect();
        $payments = collect();
        foreach ($visits as $visit) {
            if (random_int(1, 100) > 90) {
                continue;
            }
            $total = round(max(100, (float) ($visitTotals[$visit->id] ?? random_int(300, 2000))), 2);
            $discount = round($total * (random_int(0, 20) / 100), 2);
            $net = round($total - $discount, 2);
            $invoiceDate = $this->randomDate(Carbon::parse((string) $visit->visit_date), $end);
            $status = $invoiceDate->gte($end->copy()->subDays(2))
                ? $this->weighted(['unpaid' => 45, 'partially_paid' => 30, 'paid' => 20, 'cancelled' => 5])
                : $this->weighted(['paid' => 55, 'partially_paid' => 25, 'unpaid' => 15, 'cancelled' => 5]);
            $method = ['cash', 'card', 'insurance'][array_rand(['cash', 'card', 'insurance'])];
            $invoice = Invoice::query()->create([
                'patient_id' => $visit->patient_id,
                'visit_id' => $visit->id,
                'source_visit_ids' => [$visit->id],
                'total_amount' => $total,
                'total_amount_input' => $total,
                'discount' => $discount,
                'discount_input' => $discount,
                'net_amount' => $net,
                'net_amount_input' => $net,
                'currency' => 'AFN',
                'exchange_rate' => 1,
                'invoice_date' => $invoiceDate->format('Y-m-d'),
                'status' => $status,
                'payment_type' => $method,
                'notes' => '3-month seed',
                'created_by' => $actor,
                'updated_by' => $actor,
            ]);
            $invoices->push($invoice);

            if ($status === 'cancelled' || $status === 'unpaid' || $net <= 0) {
                continue;
            }
            $payDate = $this->randomDate($invoiceDate, $end)->format('Y-m-d');
            if ($status === 'partially_paid') {
                $amt = round(max(1, $net * (random_int(30, 70) / 100)), 2);
                $amt = min($amt, max(1, round($net - 1, 2)));
                $payments->push(Payment::query()->create([
                    'invoice_id' => $invoice->id, 'payment_date' => $payDate, 'amount' => $amt, 'amount_input' => $amt,
                    'currency' => 'AFN', 'exchange_rate' => 1, 'method' => $method, 'notes' => 'partial seed',
                    'created_by' => $actor, 'updated_by' => $actor,
                ]));
            } else {
                $payments->push(Payment::query()->create([
                    'invoice_id' => $invoice->id, 'payment_date' => $payDate, 'amount' => $net, 'amount_input' => $net,
                    'currency' => 'AFN', 'exchange_rate' => 1, 'method' => $method, 'notes' => 'full seed',
                    'created_by' => $actor, 'updated_by' => $actor,
                ]));
            }
        }

        foreach ($patients->shuffle()->take(50) as $patient) {
            for ($i = 1; $i <= random_int(1, 2); $i++) {
                PatientSessionTask::query()->create([
                    'patient_id' => $patient->id,
                    'title' => "Task {$i} for {$patient->patient_code}",
                    'mark' => ['green', 'blue', 'yellow', 'orange', 'red', 'purple'][array_rand(['a', 'b', 'c', 'd', 'e', 'f'])],
                    'status' => $this->weighted(['pending' => 40, 'in_progress' => 35, 'done' => 25]),
                    'notes' => '3-month seed',
                    'created_by' => $adminId,
                    'updated_by' => $adminId,
                ]);
            }
        }

        foreach ($visitTreatments->shuffle()->take((int) floor($visitTreatments->count() * 0.5)) as $vt) {
            $inv = $inventory->random();
            $used = random_int(1, 3);
            VisitTreatmentMaterial::query()->create([
                'visit_treatment_id' => $vt->id,
                'inventory_item_id' => $inv->id,
                'item_name' => $inv->item_name,
                'unit' => $inv->unit,
                'quantity_used' => $used,
                'created_by' => $adminId,
                'updated_by' => $adminId,
            ]);
        }

        $visitMap = $visits->keyBy('id');
        foreach ($visitTreatments->shuffle()->take((int) floor($visitTreatments->count() * 0.35)) as $vt) {
            $visit = $visitMap->get($vt->visit_id);
            if (!$visit) {
                continue;
            }
            $pres = Prescription::query()->create([
                'visit_treatment_id' => $vt->id,
                'visit_id' => $visit->id,
                'patient_id' => $visit->patient_id,
                'dentist_id' => $visit->dentist_id,
                'content' => 'seed prescription',
                'medicine_name' => ['Ibuprofen', 'Paracetamol', 'Amoxicillin'][array_rand(['a', 'b', 'c'])],
                'dosage_unit' => ['tablet', 'capsule', 'ml'][array_rand(['a', 'b', 'c'])],
                'dosage_amount' => (string) random_int(1, 2),
                'frequency' => ['once daily', 'twice daily', 'every 8 hours'][array_rand(['a', 'b', 'c'])],
                'food_timing' => ['before_food', 'after_food', 'anytime'][array_rand(['a', 'b', 'c'])],
                'created_by' => $adminId,
                'updated_by' => $adminId,
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $pres->id,
                'name' => 'Seed Item',
                'unit' => 'tablet',
                'amount' => '1',
                'frequency' => 'twice daily',
                'food_timing' => 'after_food',
                'created_by' => $adminId,
                'updated_by' => $adminId,
            ]);
        }

        $expenses = collect();
        for ($i = 1; $i <= 100; $i++) {
            $qty = random_int(1, 5);
            $unitCost = (float) random_int(80, 1500);
            $amount = round($qty * $unitCost, 2);
            $expenses->push(Expense::query()->create([
                'expense_type' => random_int(1, 100) <= 55 ? 'daily' : 'clinical',
                'title' => "Expense {$i}",
                'category' => $i % 2 === 0 ? 'Operations' : 'Clinical Materials',
                'amount' => $amount,
                'amount_input' => $amount,
                'currency' => 'AFN',
                'exchange_rate' => 1,
                'expense_date' => $this->randomDate($start, $end)->format('Y-m-d'),
                'payment_method' => ['cash', 'card', 'insurance'][array_rand(['cash', 'card', 'insurance'])],
                'vendor' => "Vendor {$i}",
                'quantity' => $qty,
                'unit_cost' => $unitCost,
                'unit_cost_input' => $unitCost,
                'notes' => '3-month seed',
                'source_id' => null,
                'source_type' => null,
                'staff_id' => $staff->random()->id,
                'created_by' => $adminId,
                'updated_by' => $adminId,
            ]));
        }

        $salary = collect();
        foreach ($this->months($start, $end) as $month) {
            $monthStart = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
            $isCurrentMonth = $monthStart->isSameMonth($end) && $monthStart->isSameYear($end);
            foreach ($staff as $member) {
                $gross = (float) random_int(18_000, 65_000);
                $bonus = (float) random_int(0, 4_000);
                $ded = (float) random_int(0, 2_000);
                $net = round(max(0, $gross + $bonus - $ded), 2);
                $status = $isCurrentMonth ? $this->weighted(['pending' => 45, 'paid' => 45, 'partial' => 10]) : $this->weighted(['paid' => 80, 'partial' => 12, 'pending' => 8]);
                $salary->push(SalaryPayment::query()->create([
                    'staff_id' => $member->id,
                    'salary_month' => $month,
                    'payment_date' => ($isCurrentMonth ? $this->randomDate($monthStart, $end) : $monthStart->copy()->day(min(random_int(24, 28), $monthStart->daysInMonth)))->format('Y-m-d'),
                    'gross_amount' => $gross,
                    'gross_amount_input' => $gross,
                    'bonus_amount' => $bonus,
                    'bonus_amount_input' => $bonus,
                    'deduction_amount' => $ded,
                    'deduction_amount_input' => $ded,
                    'net_amount' => $net,
                    'net_amount_input' => $net,
                    'currency' => 'AFN',
                    'exchange_rate' => 1,
                    'status' => $status,
                    'paid_from_safe' => $status !== 'pending',
                    'notes' => '3-month seed',
                    'created_by' => $adminId,
                    'updated_by' => $adminId,
                ]));
            }
        }

        SafeTransaction::query()->create([
            'transaction_date' => $start->format('Y-m-d'),
            'entry_type' => 'deposit',
            'direction' => 'in',
            'amount' => 2_000_000,
            'amount_input' => 2_000_000,
            'currency' => 'AFN',
            'exchange_rate' => 1,
            'source_id' => null,
            'source_type' => null,
            'picked_by_staff_id' => null,
            'notes' => 'opening seed safe balance',
            'created_by' => $adminId,
            'updated_by' => $adminId,
        ]);

        foreach ($payments as $p) {
            SafeTransaction::query()->create([
                'transaction_date' => (string) $p->payment_date, 'entry_type' => 'income', 'direction' => 'in',
                'amount' => $p->amount, 'amount_input' => $p->amount_input ?? $p->amount, 'currency' => 'AFN', 'exchange_rate' => 1,
                'source_id' => $p->id, 'source_type' => 'payment', 'picked_by_staff_id' => null, 'notes' => "payment #{$p->id}",
                'created_by' => $adminId, 'updated_by' => $adminId,
            ]);
        }
        foreach ($expenses as $e) {
            SafeTransaction::query()->create([
                'transaction_date' => (string) $e->expense_date, 'entry_type' => 'expense', 'direction' => 'out',
                'amount' => $e->amount, 'amount_input' => $e->amount_input ?? $e->amount, 'currency' => 'AFN', 'exchange_rate' => 1,
                'source_id' => $e->id, 'source_type' => 'expense', 'picked_by_staff_id' => $e->staff_id, 'notes' => $e->title,
                'created_by' => $adminId, 'updated_by' => $adminId,
            ]);
        }
        foreach ($salary as $s) {
            if (!$s->paid_from_safe || $s->status === 'pending') {
                continue;
            }
            SafeTransaction::query()->create([
                'transaction_date' => (string) $s->payment_date, 'entry_type' => 'salary', 'direction' => 'out',
                'amount' => $s->net_amount, 'amount_input' => $s->net_amount_input ?? $s->net_amount, 'currency' => 'AFN', 'exchange_rate' => 1,
                'source_id' => $s->id, 'source_type' => 'salary_payment', 'picked_by_staff_id' => $s->staff_id, 'notes' => "salary {$s->salary_month}",
                'created_by' => $adminId, 'updated_by' => $adminId,
            ]);
        }

        $shareholders = collect();
        foreach ([[40, 600_000, 'Hamid Rahimi'], [25, 400_000, 'Amina Farzan'], [20, 300_000, 'Sami Wardak'], [15, 250_000, 'Laila Mohammadi']] as $idx => $meta) {
            $shareholders->push(Shareholder::query()->create([
                'full_name' => $meta[2],
                'contact_number' => $this->seedPhone('07', "sh{$seed}", $idx + 1),
                'email' => strtolower(str_replace(' ', '.', $meta[2])).".{$seed}@clinic.test",
                'address' => 'Kabul',
                'ownership_percentage' => $meta[0],
                'initial_capital' => $meta[1],
                'initial_capital_input' => $meta[1],
                'currency' => 'AFN',
                'exchange_rate' => 1,
                'joined_date' => $this->randomDate($start->copy()->subMonths(6), $start)->format('Y-m-d'),
                'status' => $idx === 3 ? 'inactive' : 'active',
                'notes' => '3-month seed',
                'created_by' => $adminId,
                'updated_by' => $adminId,
            ]));
        }

        $balances = $shareholders->mapWithKeys(fn ($s) => [$s->id => (float) $s->initial_capital])->all();
        foreach ($shareholders as $sh) {
            for ($i = 1; $i <= random_int(4, 7); $i++) {
                $contrib = random_int(1, 100) <= 65 || ($balances[$sh->id] ?? 0) < 5_000;
                if ($contrib) {
                    $type = 'contribution';
                    $entry = 'deposit';
                    $dir = 'in';
                    $amt = (float) random_int(5_000, 35_000);
                    $balances[$sh->id] = round(($balances[$sh->id] ?? 0) + $amt, 2);
                } else {
                    $type = 'distribution';
                    $entry = 'withdrawal';
                    $dir = 'out';
                    $max = max(3_000, min(25_000, (int) floor(($balances[$sh->id] ?? 0) * 0.4)));
                    $amt = (float) random_int(3_000, $max);
                    $balances[$sh->id] = round(max(0, ($balances[$sh->id] ?? 0) - $amt), 2);
                }
                $date = $this->randomDate($start, $end)->format('Y-m-d');
                $tx = ShareholderTransaction::query()->create([
                    'shareholder_id' => $sh->id,
                    'transaction_date' => $date,
                    'transaction_type' => $type,
                    'amount' => $amt,
                    'amount_input' => $amt,
                    'currency' => 'AFN',
                    'exchange_rate' => 1,
                    'safe_transaction_id' => null,
                    'notes' => '3-month seed',
                    'created_by' => $adminId,
                    'updated_by' => $adminId,
                ]);
                $safe = SafeTransaction::query()->create([
                    'transaction_date' => $date, 'entry_type' => $entry, 'direction' => $dir,
                    'amount' => $amt, 'amount_input' => $amt, 'currency' => 'AFN', 'exchange_rate' => 1,
                    'source_id' => $tx->id, 'source_type' => 'shareholder_transaction', 'picked_by_staff_id' => null,
                    'notes' => "shareholder {$type} {$sh->full_name}",
                    'created_by' => $adminId, 'updated_by' => $adminId,
                ]);
                $tx->safe_transaction_id = $safe->id;
                $tx->saveQuietly();
            }
        }

        DentalBackupSchedule::query()->updateOrCreate(
            ['id' => 1],
            [
                'frequency' => 'weekly',
                'run_at_time' => '02:30',
                'run_day_of_week' => 6,
                'is_active' => true,
                'last_run_at' => now()->subHours(3),
                'updated_by' => $adminId,
            ]
        );
        for ($dt = $start->copy()->startOfWeek(); $dt->lte($end); $dt->addWeek()) {
            $to = $dt->copy()->addDays(6);
            if ($to->gt($end)) {
                $to = $end->copy();
            }
            DentalBackup::query()->create([
                'mode' => $dt->isSameWeek($start) ? 'full' : 'incremental',
                'frequency' => 'weekly',
                'start_date' => $dt->format('Y-m-d'),
                'end_date' => $to->format('Y-m-d'),
                'status' => 'completed',
                'file_path' => 'backups/dental/seed-'.$to->format('Ymd').'.zip',
                'file_size_bytes' => random_int(2_000_000, 10_000_000),
                'summary' => [
                    'patients' => $patients->count(),
                    'appointments' => $appointments->count(),
                    'visits' => $visits->count(),
                    'invoices' => $invoices->count(),
                    'payments' => $payments->count(),
                ],
                'notes' => '3-month seed',
                'triggered_by' => $adminId,
                'completed_at' => $to->copy()->setTime(2, 45),
            ]);
        }

        if (Schema::hasTable('debts')) {
            app(DebtService::class)->syncAll();
        }
    }

    private function ensureCoreSeeders(): void
    {
        $hasUsers = User::query()->whereIn('email', ['superadmin@system.af', 'admin@system.af'])->count() === 2;
        if ($hasUsers) {
            return;
        }

        $this->call([
            ModulesSeeder::class,
            PermissionsSeeder::class,
            RolesSeeder::class,
            AssignPermissionsToModuleRolesSeeder::class,
            SuperAdminUserSeeder::class,
            AdminUserSeeder::class,
        ]);
    }

    private function randomDate(Carbon $from, Carbon $to): Carbon
    {
        $start = $from->copy()->startOfDay()->timestamp;
        $end = $to->copy()->endOfDay()->timestamp;
        if ($end <= $start) {
            return $from->copy();
        }

        return Carbon::createFromTimestamp(random_int($start, $end));
    }

    private function weighted(array $weights): string
    {
        $r = random_int(1, max(1, array_sum($weights)));
        foreach ($weights as $value => $weight) {
            $r -= $weight;
            if ($r <= 0) {
                return (string) $value;
            }
        }

        return (string) array_key_last($weights);
    }

    private function seedPhone(string $prefix, string $seed, int $index): string
    {
        $seedNumber = abs((int) crc32("{$seed}-{$index}")) % 100_000_000;

        return $prefix.str_pad((string) $seedNumber, max(0, 10 - strlen($prefix)), '0', STR_PAD_LEFT);
    }

    private function months(Carbon $from, Carbon $to): array
    {
        $months = [];
        $cursor = $from->copy()->startOfMonth();
        $last = $to->copy()->startOfMonth();
        while ($cursor->lte($last)) {
            $months[] = $cursor->format('Y-m');
            $cursor->addMonth();
        }

        return $months;
    }
}
