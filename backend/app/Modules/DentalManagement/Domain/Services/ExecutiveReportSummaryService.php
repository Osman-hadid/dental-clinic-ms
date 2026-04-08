<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\DentalManagement\Domain\Entities\Appointment;
use App\Modules\DentalManagement\Domain\Entities\Expense;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use App\Modules\DentalManagement\Domain\Entities\PatientSessionTask;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Domain\Entities\SalaryPayment;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use App\Modules\DentalManagement\Domain\Services\Concerns\InteractsWithReportData;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

final class ExecutiveReportSummaryService
{
    use InteractsWithReportData;

    public function build(array $filters): array
    {
        $startDate = CarbonImmutable::parse((string) $filters['startDate'])->startOfDay();
        $endDate = CarbonImmutable::parse((string) $filters['endDate'])->endOfDay();
        $granularity = $this->normalizeGranularity((string) ($filters['granularity'] ?? 'day'));
        $statusFilter = $this->normalizeFilter((string) ($filters['statusFilter'] ?? 'all'));
        $dentistFilter = $this->normalizeFilter((string) ($filters['dentistFilter'] ?? 'all'));
        $treatmentFilter = mb_strtolower($this->normalizeFilter((string) ($filters['treatmentFilter'] ?? 'all')));
        $paymentMethodFilter = mb_strtolower($this->normalizeFilter((string) ($filters['paymentMethodFilter'] ?? 'all')));
        $patientFilter = $this->normalizeFilter((string) ($filters['patientFilter'] ?? 'all'));

        $patients = Patient::query()
            ->select(['id', 'patient_code', 'first_name', 'last_name', 'created_at'])
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->get();

        $appointments = Appointment::query()
            ->select(['id', 'patient_id', 'dentist_id', 'appointment_date', 'status'])
            ->with(['dentist:id,full_name'])
            ->where('appointment_date', '>=', $startDate->toDateString())
            ->where('appointment_date', '<=', $endDate->toDateString())
            ->get();

        $visits = Visit::query()
            ->select(['id', 'patient_id', 'dentist_id', 'visit_date'])
            ->with(['dentist:id,full_name'])
            ->where('visit_date', '>=', $startDate->toDateString())
            ->where('visit_date', '<=', $endDate->toDateString())
            ->get();

        $visitTreatments = VisitTreatment::query()
            ->select(['id', 'visit_id', 'treatment_id', 'price', 'notes', 'created_at'])
            ->with([
                'treatment:id,name,category',
                'visit:id,patient_id,dentist_id,visit_date',
                'visit.dentist:id,full_name',
            ])
            ->whereHas('visit', static function ($query) use ($startDate, $endDate): void {
                $query
                    ->where('visit_date', '>=', $startDate->toDateString())
                    ->where('visit_date', '<=', $endDate->toDateString());
            })
            ->get();

        $invoices = Invoice::query()
            ->select(['id', 'patient_id', 'visit_id', 'total_amount', 'total_amount_input', 'discount', 'net_amount', 'net_amount_input', 'currency', 'exchange_rate', 'invoice_date', 'status'])
            ->with([
                'payments:id,invoice_id,payment_date,amount,amount_input,currency,exchange_rate,method',
                'visit:id,patient_id,dentist_id,visit_date',
                'visit.dentist:id,full_name',
            ])
            ->where('invoice_date', '>=', $startDate->toDateString())
            ->where('invoice_date', '<=', $endDate->toDateString())
            ->get();

        $expenses = Expense::query()
            ->select(['id', 'expense_type', 'category', 'amount', 'amount_input', 'currency', 'exchange_rate', 'expense_date'])
            ->where('expense_date', '>=', $startDate->toDateString())
            ->where('expense_date', '<=', $endDate->toDateString())
            ->get();

        $safeTransactions = SafeTransaction::query()
            ->select(['id', 'transaction_date', 'entry_type', 'direction', 'amount', 'amount_input', 'currency', 'exchange_rate', 'source_type', 'notes'])
            ->where('transaction_date', '<=', $endDate->toDateString())
            ->get();

        $salaryPayments = SalaryPayment::query()
            ->select(['id', 'payment_date', 'net_amount', 'net_amount_input', 'currency', 'exchange_rate', 'status'])
            ->where('payment_date', '>=', $startDate->toDateString())
            ->where('payment_date', '<=', $endDate->toDateString())
            ->get();

        $patientSessionTasks = PatientSessionTask::query()
            ->select(['id', 'patient_id', 'title', 'status', 'notes', 'created_at', 'updated_at'])
            ->where('created_at', '>=', $startDate->startOfDay())
            ->where('created_at', '<=', $endDate->endOfDay())
            ->get();

        $patientNames = $patients->mapWithKeys(fn (Patient $patient): array => [
            (string) $patient->id => $this->patientName($patient),
        ]);

        $dentistOptions = [];
        $treatmentOptions = [];
        $treatmentNamesByVisitId = [];

        foreach ($appointments as $appointment) {
            $dentist = $this->dentistName($appointment->dentist?->full_name, $appointment->dentist_id);
            if ($dentist !== '') {
                $dentistOptions[$dentist] = true;
            }
        }

        foreach ($visits as $visit) {
            $dentist = $this->dentistName($visit->dentist?->full_name, $visit->dentist_id);
            if ($dentist !== '') {
                $dentistOptions[$dentist] = true;
            }
        }

        foreach ($visitTreatments as $visitTreatment) {
            $visitId = (string) ($visitTreatment->visit_id ?? '');
            $treatmentName = $this->treatmentName($visitTreatment);
            if ($treatmentName !== '') {
                $treatmentOptions[$treatmentName] = true;
            }
            if ($visitId !== '' && $treatmentName !== '') {
                $treatmentNamesByVisitId[$visitId] ??= [];
                $treatmentNamesByVisitId[$visitId][mb_strtolower($treatmentName)] = true;
            }
        }

        $paymentRows = collect();
        $paymentMethodOptions = [];
        $paymentMethodsByInvoiceId = [];
        $paidByInvoiceId = [];

        foreach ($invoices as $invoice) {
            $invoiceId = (string) $invoice->id;
            foreach ($invoice->payments as $payment) {
                $method = mb_strtolower($this->stringOrFallback($payment->method ?? null, 'cash'));
                $amount = $this->toFloat($payment->amount ?? 0);
                $currency = $this->currencyCode($payment->currency);
                $exchangeRate = $this->toFloat($payment->exchange_rate ?? 1) ?: 1.0;
                $amountInput = $this->resolveInputAmount($payment->amount_input, $payment->amount, $currency, $exchangeRate);
                if ($amount <= 0) {
                    continue;
                }

                $paymentRows->push([
                    'amount' => $amount,
                    'amountInput' => $amountInput,
                    'currency' => $currency,
                    'date' => $this->dateString($payment->payment_date),
                    'exchangeRate' => $exchangeRate,
                    'invoiceId' => $invoiceId,
                    'method' => $method,
                ]);
                $paidByInvoiceId[$invoiceId] = ($paidByInvoiceId[$invoiceId] ?? 0) + $amount;
                $paymentMethodOptions[$method] = true;
                $paymentMethodsByInvoiceId[$invoiceId] ??= [];
                $paymentMethodsByInvoiceId[$invoiceId][$method] = true;
            }
        }

        $visitsById = $visits->keyBy(fn (Visit $visit): string => (string) $visit->id);
        $invoicesById = $invoices->keyBy(fn (Invoice $invoice): string => (string) $invoice->id);

        $filteredAppointments = $appointments->filter(function (Appointment $appointment) use ($dentistFilter, $patientFilter, $statusFilter): bool {
            if ($patientFilter !== '' && (string) $appointment->patient_id !== $patientFilter) {
                return false;
            }

            if (!$this->matchesDentistFilter($dentistFilter, $appointment->dentist?->full_name, $appointment->dentist_id)) {
                return false;
            }

            if ($statusFilter !== '' && $this->toReportStatus((string) ($appointment->status ?? 'pending')) !== $statusFilter) {
                return false;
            }

            return true;
        })->values();

        $filteredVisits = $visits->filter(function (Visit $visit) use ($dentistFilter, $patientFilter): bool {
            if ($patientFilter !== '' && (string) $visit->patient_id !== $patientFilter) {
                return false;
            }

            return $this->matchesDentistFilter($dentistFilter, $visit->dentist?->full_name, $visit->dentist_id);
        })->values();

        $filteredVisitTreatments = $visitTreatments->filter(function (VisitTreatment $visitTreatment) use ($dentistFilter, $patientFilter, $treatmentFilter, $visitsById): bool {
            $treatmentName = mb_strtolower($this->treatmentName($visitTreatment));
            if ($treatmentFilter !== '' && $treatmentName !== $treatmentFilter) {
                return false;
            }

            $visit = $visitsById->get((string) $visitTreatment->visit_id);
            if ($patientFilter !== '' && (string) ($visit?->patient_id ?? '') !== $patientFilter) {
                return false;
            }

            return $this->matchesDentistFilter($dentistFilter, $visit?->dentist?->full_name, $visit?->dentist_id);
        })->values();

        $filteredInvoices = $invoices->filter(function (Invoice $invoice) use ($dentistFilter, $patientFilter, $paymentMethodFilter, $paymentMethodsByInvoiceId, $statusFilter, $treatmentFilter, $treatmentNamesByVisitId): bool {
            if ($patientFilter !== '' && (string) $invoice->patient_id !== $patientFilter) {
                return false;
            }

            if ($statusFilter !== '' && $this->toReportStatus((string) ($invoice->status ?? 'pending')) !== $statusFilter) {
                return false;
            }

            if (!$this->matchesDentistFilter($dentistFilter, $invoice->visit?->dentist?->full_name, $invoice->visit?->dentist_id)) {
                return false;
            }

            if ($treatmentFilter !== '') {
                $visitTreatmentsForVisit = $treatmentNamesByVisitId[(string) ($invoice->visit_id ?? '')] ?? [];
                if (!isset($visitTreatmentsForVisit[$treatmentFilter])) {
                    return false;
                }
            }

            if ($paymentMethodFilter !== '') {
                $methods = $paymentMethodsByInvoiceId[(string) $invoice->id] ?? [];
                if (!isset($methods[$paymentMethodFilter])) {
                    return false;
                }
            }

            return true;
        })->values();

        $filteredPayments = $paymentRows->filter(function (array $paymentRow) use ($dentistFilter, $endDate, $invoicesById, $patientFilter, $paymentMethodFilter, $startDate, $statusFilter, $treatmentFilter, $treatmentNamesByVisitId): bool {
            $paymentDate = $this->parseDate((string) $paymentRow['date']);
            if ($paymentDate === null || $paymentDate->lt($startDate) || $paymentDate->gt($endDate)) {
                return false;
            }

            if ($paymentMethodFilter !== '' && $paymentRow['method'] !== $paymentMethodFilter) {
                return false;
            }

            /** @var Invoice|null $invoice */
            $invoice = $invoicesById->get((string) $paymentRow['invoiceId']);
            if ($invoice === null) {
                return false;
            }

            if ($patientFilter !== '' && (string) $invoice->patient_id !== $patientFilter) {
                return false;
            }

            if ($statusFilter !== '' && $this->toReportStatus((string) ($invoice->status ?? 'pending')) !== $statusFilter) {
                return false;
            }

            if ($treatmentFilter !== '') {
                $visitTreatmentsForVisit = $treatmentNamesByVisitId[(string) ($invoice->visit_id ?? '')] ?? [];
                if (!isset($visitTreatmentsForVisit[$treatmentFilter])) {
                    return false;
                }
            }

            return $this->matchesDentistFilter($dentistFilter, $invoice->visit?->dentist?->full_name, $invoice->visit?->dentist_id);
        })->values();

        $currencySections = $this->initializeCurrencySections([
            'bankBalance',
            'billed',
            'cashInSafe',
            'debt',
            'expenses',
            'paid',
            'profitLoss',
            'safeOut',
            'salaryPaid',
            'thirdCompanyPaid',
            'thirdCompanyUnpaid',
        ]);
        $inventorySafePurchases = $safeTransactions->filter(function (SafeTransaction $safeTransaction) use ($startDate, $endDate): bool {
            $date = $this->parseDate($this->dateString($safeTransaction->transaction_date));
            if ($date === null || $date->lt($startDate) || $date->gt($endDate)) {
                return false;
            }

            return (string) ($safeTransaction->direction ?? '') === 'out'
                && (string) ($safeTransaction->source_type ?? '') === 'inventory_item'
                && (string) ($safeTransaction->entry_type ?? '') === 'expense';
        })->values();

        [$expenseSummary, $dailyExpenses, $clinicalExpenses] = $this->buildExpenseSummary($expenses, $inventorySafePurchases);
        $thirdCompanySummary = $this->buildThirdCompanySummary($patientSessionTasks, $patientFilter, $statusFilter);

        $billed = $this->toTwoDecimals($filteredInvoices->sum(fn (Invoice $invoice): float => $this->toFloat($invoice->total_amount ?? 0)));
        $discount = $this->toTwoDecimals($filteredInvoices->sum(fn (Invoice $invoice): float => $this->toFloat($invoice->discount ?? 0)));
        $net = $this->toTwoDecimals($filteredInvoices->sum(fn (Invoice $invoice): float => $this->toFloat($invoice->net_amount ?? 0)));
        $paid = $this->toTwoDecimals($filteredPayments->sum(fn (array $payment): float => (float) $payment['amount']));
        $debt = 0.0;

        foreach ($filteredInvoices as $invoice) {
            $currency = $this->currencyCode($invoice->currency);
            $exchangeRate = $this->toFloat($invoice->exchange_rate ?? 1) ?: 1.0;
            $this->addCurrencySectionValue(
                $currencySections,
                $currency,
                'billed',
                $this->resolveInputAmount($invoice->total_amount_input, $invoice->total_amount, $currency, $exchangeRate)
            );

            $status = mb_strtolower((string) ($invoice->status ?? 'unpaid'));
            if (!\in_array($status, ['unpaid', 'partially_paid'], true)) {
                continue;
            }

            $invoiceId = (string) $invoice->id;
            $netAmount = $this->toFloat($invoice->net_amount ?? 0);
            $paidAmount = (float) ($paidByInvoiceId[$invoiceId] ?? 0);
            $remaining = max(0, $netAmount - $paidAmount);
            $debt += $remaining;
            $this->addCurrencySectionValue(
                $currencySections,
                $currency,
                'debt',
                $this->convertBaseAmountToInputCurrency($remaining, $currency, $exchangeRate)
            );
        }

        $debt = $this->toTwoDecimals($debt);

        $activePatients = [];
        foreach ($filteredVisits as $visit) {
            if ($visit->patient_id !== null) {
                $activePatients[(string) $visit->patient_id] = true;
            }
        }
        foreach ($filteredInvoices as $invoice) {
            if ($invoice->patient_id !== null) {
                $activePatients[(string) $invoice->patient_id] = true;
            }
        }

        foreach ($filteredPayments as $payment) {
            $currency = $this->currencyCode($payment['currency'] ?? 'AFN');
            $amountInput = (float) ($payment['amountInput'] ?? $payment['amount'] ?? 0);
            $this->addCurrencySectionValue($currencySections, $currency, 'paid', $amountInput);

            if (\in_array((string) ($payment['method'] ?? ''), ['bank', 'bank_transfer', 'transfer', 'card'], true)) {
                $this->addCurrencySectionValue($currencySections, $currency, 'bankBalance', $amountInput);
            }
        }

        foreach ($dailyExpenses->concat($clinicalExpenses) as $expense) {
            $currency = $this->currencyCode($expense->currency);
            $this->addCurrencySectionValue(
                $currencySections,
                $currency,
                'expenses',
                $this->resolveInputAmount($expense->amount_input, $expense->amount, $currency, $expense->exchange_rate)
            );
        }

        $salaryPaid = 0.0;
        foreach ($salaryPayments as $salaryPayment) {
            if (!\in_array((string) $salaryPayment->status, ['paid', 'partial'], true)) {
                continue;
            }

            $amount = $this->toFloat($salaryPayment->net_amount ?? 0);
            $salaryPaid += $amount;
            $currency = $this->currencyCode($salaryPayment->currency);
            $this->addCurrencySectionValue(
                $currencySections,
                $currency,
                'salaryPaid',
                $this->resolveInputAmount($salaryPayment->net_amount_input, $salaryPayment->net_amount, $currency, $salaryPayment->exchange_rate)
            );
        }
        $salaryPaid = $this->toTwoDecimals($salaryPaid);

        $collectionRate = $net > 0 ? round(min(100, ($paid / $net) * 100), 1) : 0.0;
        $appointmentCompletionRate = $filteredAppointments->count() > 0
            ? round(min(100, ($filteredVisits->count() / $filteredAppointments->count()) * 100), 1)
            : 0.0;
        $safeOut = 0.0;
        $cashInSafe = 0.0;
        foreach ($safeTransactions as $safeTransaction) {
            $date = $this->parseDate($this->dateString($safeTransaction->transaction_date));
            if ($date === null || $date->gt($endDate)) {
                continue;
            }

            $amount = $this->toFloat($safeTransaction->amount ?? 0);
            $currency = $this->currencyCode($safeTransaction->currency);
            $amountInput = $this->resolveInputAmount($safeTransaction->amount_input, $safeTransaction->amount, $currency, $safeTransaction->exchange_rate);
            if ($safeTransaction->direction === 'in') {
                $cashInSafe += $amount;
                $this->addCurrencySectionValue($currencySections, $currency, 'cashInSafe', $amountInput);
            } else {
                $cashInSafe -= $amount;
                $this->addCurrencySectionValue($currencySections, $currency, 'cashInSafe', -$amountInput);
                if (!$date->lt($startDate)) {
                    $safeOut += $amount;
                    $this->addCurrencySectionValue($currencySections, $currency, 'safeOut', $amountInput);
                }
            }
        }
        $safeOut = $this->toTwoDecimals($safeOut);
        $totalOutcome = $this->toTwoDecimals($expenseSummary['total'] + $salaryPaid + $thirdCompanySummary['totalPaid']);
        $profitOrLoss = $this->toTwoDecimals($paid - $totalOutcome);
        $netAfterExpenses = $this->toTwoDecimals($paid - $expenseSummary['total']);
        $profitLossTrend = $this->buildProfitLossTrend($filteredPayments, $dailyExpenses, $clinicalExpenses, $salaryPayments, $granularity);
        $revenueTrendMonthly = $this->buildRevenueTrend($filteredPayments);
        $treatmentVolume = $this->buildTreatmentVolume($filteredVisitTreatments);
        $dentistProductivity = $this->buildDentistProductivity($filteredInvoices, $filteredVisits);
        $implantPlacementTrend = $this->buildImplantPlacementTrend($filteredVisitTreatments);
        $implantRevenue = $this->toTwoDecimals(collect($implantPlacementTrend)->sum(fn (array $row): float => (float) $row['revenue']));
        $bankBalance = $this->toTwoDecimals($filteredPayments
            ->filter(fn (array $payment): bool => \in_array($payment['method'], ['bank', 'bank_transfer', 'transfer', 'card'], true))
            ->sum(fn (array $payment): float => (float) $payment['amount']));
        $cashInSafe = $this->toTwoDecimals($cashInSafe);
        foreach (['AFN', 'USD'] as $currency) {
            $currencySections[$currency]['thirdCompanyPaid'] = $this->toTwoDecimals((float) ($thirdCompanySummary['currencySummary'][$currency]['paid'] ?? 0));
            $currencySections[$currency]['thirdCompanyUnpaid'] = $this->toTwoDecimals((float) ($thirdCompanySummary['currencySummary'][$currency]['unpaid'] ?? 0));
            $currencySections[$currency]['profitLoss'] = $this->toTwoDecimals(
                (float) ($currencySections[$currency]['paid'] ?? 0)
                - (
                    (float) ($currencySections[$currency]['expenses'] ?? 0)
                    + (float) ($currencySections[$currency]['salaryPaid'] ?? 0)
                    + (float) ($currencySections[$currency]['thirdCompanyPaid'] ?? 0)
                )
            );
        }
        $newPatientsCount = $patients->filter(function (Patient $patient) use ($endDate, $patientFilter, $startDate): bool {
            if ($patientFilter !== '' && (string) $patient->id !== $patientFilter) {
                return false;
            }

            return $this->dateWithin($patient->created_at, $startDate, $endDate);
        })->count();
        $treatmentAcceptanceRate = $filteredAppointments->count() > 0
            ? round(min(100, ($filteredVisits->count() / $filteredAppointments->count()) * 100), 1)
            : 0.0;
        $chairUtilizationRate = round(min(100, ($filteredVisits->count() / max(1, $startDate->diffInDays($endDate) + 1)) * 100), 1);

        $dentistLabels = array_keys($dentistOptions);
        sort($dentistLabels, SORT_NATURAL | SORT_FLAG_CASE);
        $treatmentLabels = array_keys($treatmentOptions);
        sort($treatmentLabels, SORT_NATURAL | SORT_FLAG_CASE);
        $paymentMethods = array_keys($paymentMethodOptions);
        sort($paymentMethods, SORT_NATURAL | SORT_FLAG_CASE);

        return [
            'bankBalance' => $bankBalance,
            'cashInSafe' => $cashInSafe,
            'chairUtilizationRate' => $chairUtilizationRate,
            'currencySections' => $currencySections,
            'dentistProductivity' => $dentistProductivity,
            'expenseSummary' => $expenseSummary,
            'filterOptions' => [
                'dentists' => $dentistLabels,
                'patients' => $patients->map(fn (Patient $patient): array => [
                    'id' => (string) $patient->id,
                    'name' => $patientNames->get((string) $patient->id, "Patient #{$patient->id}"),
                ])->values()->all(),
                'paymentMethods' => $paymentMethods,
                'treatments' => $treatmentLabels,
            ],
            'implantPlacementTrend' => $implantPlacementTrend,
            'implantRevenue' => $implantRevenue,
            'kpis' => [
                'activePatients' => count($activePatients),
                'appointmentCompletionRate' => $appointmentCompletionRate,
                'appointments' => $filteredAppointments->count(),
                'billed' => $billed,
                'collectionRate' => $collectionRate,
                'debt' => $debt,
                'discount' => $discount,
                'expenses' => $expenseSummary['total'],
                'net' => $net,
                'netAfterExpenses' => $netAfterExpenses,
                'paid' => $paid,
                'safeOut' => $safeOut,
                'salaryPaid' => $salaryPaid,
                'thirdCompanyPaid' => $thirdCompanySummary['totalPaid'],
                'thirdCompanyTotal' => $thirdCompanySummary['totalSupplierCost'],
                'thirdCompanyUnpaid' => $thirdCompanySummary['totalUnpaid'],
                'thirdCompanyUnpaidCount' => $thirdCompanySummary['unpaidCount'],
                'totalPatients' => $patients->count(),
                'visits' => $filteredVisits->count(),
            ],
            'newPatientsCount' => $newPatientsCount,
            'profitLoss' => $profitOrLoss,
            'profitLossTrend' => $profitLossTrend,
            'revenueTrendMonthly' => $revenueTrendMonthly,
            'treatmentAcceptanceRate' => $treatmentAcceptanceRate,
            'treatmentVolume' => $treatmentVolume,
        ];
    }

    private function buildDentistProductivity(Collection $filteredInvoices, Collection $filteredVisits): array
    {
        $revenueByVisit = [];
        foreach ($filteredInvoices as $invoice) {
            $visitId = (string) ($invoice->visit_id ?? '');
            if ($visitId === '') {
                continue;
            }

            $revenueByVisit[$visitId] = ($revenueByVisit[$visitId] ?? 0) + $this->toFloat($invoice->net_amount ?? 0);
        }

        $grouped = [];
        foreach ($filteredVisits as $visit) {
            $dentist = $this->dentistName($visit->dentist?->full_name, $visit->dentist_id);
            if ($dentist === '') {
                $dentist = 'Unknown Dentist';
            }

            $grouped[$dentist] ??= ['dentist' => $dentist, 'revenue' => 0.0, 'visits' => 0];
            $grouped[$dentist]['visits'] += 1;
            $grouped[$dentist]['revenue'] = $this->toTwoDecimals($grouped[$dentist]['revenue'] + ($revenueByVisit[(string) $visit->id] ?? 0));
        }

        $rows = array_values($grouped);
        usort($rows, static fn (array $left, array $right): int => ($right['revenue'] <=> $left['revenue']) ?: ($right['visits'] <=> $left['visits']));

        return $rows;
    }

    private function buildExpenseSummary(Collection $expenses, ?Collection $inventorySafePurchases = null): array
    {
        $dailyExpenses = $expenses->filter(fn (Expense $expense): bool => (string) $expense->expense_type === 'daily')->values();
        $manualClinicalExpenses = $expenses->filter(fn (Expense $expense): bool => (string) $expense->expense_type === 'clinical')->values();
        $inventoryClinicalExpenses = ($inventorySafePurchases ?? collect())
            ->map(fn (SafeTransaction $safeTransaction): object => (object) [
                'amount' => $safeTransaction->amount,
                'amount_input' => $safeTransaction->amount_input,
                'category' => 'Inventory Purchase',
                'currency' => $safeTransaction->currency,
                'exchange_rate' => $safeTransaction->exchange_rate,
                'expense_date' => $safeTransaction->transaction_date,
                'expense_type' => 'clinical',
                'notes' => $safeTransaction->notes,
            ])
            ->values();
        $clinicalExpenses = $manualClinicalExpenses->concat($inventoryClinicalExpenses)->values();

        $daily = $this->toTwoDecimals($dailyExpenses->sum(fn ($expense): float => $this->toFloat($expense->amount ?? 0)));
        $clinical = $this->toTwoDecimals($clinicalExpenses->sum(fn ($expense): float => $this->toFloat($expense->amount ?? 0)));

        $categories = [];
        foreach ($dailyExpenses as $expense) {
            $category = $this->stringOrFallback($expense->category ?? null, 'Daily - Other');
            $categories[$category] = $this->toTwoDecimals(($categories[$category] ?? 0) + $this->toFloat($expense->amount ?? 0));
        }
        foreach ($clinicalExpenses as $expense) {
            $category = 'Clinical - '.$this->stringOrFallback($expense->category ?? null, 'Other');
            $categories[$category] = $this->toTwoDecimals(($categories[$category] ?? 0) + $this->toFloat($expense->amount ?? 0));
        }

        $byCategory = array_map(
            static fn (string $category, float $amount): array => ['amount' => $amount, 'category' => $category],
            array_keys($categories),
            array_values($categories)
        );
        usort($byCategory, static fn (array $left, array $right): int => $right['amount'] <=> $left['amount']);

        return [[
            'byCategory' => $byCategory,
            'clinical' => $clinical,
            'daily' => $daily,
            'total' => $this->toTwoDecimals($daily + $clinical),
        ], $dailyExpenses, $clinicalExpenses];
    }

    private function buildImplantPlacementTrend(Collection $filteredVisitTreatments): array
    {
        $grouped = [];

        foreach ($filteredVisitTreatments as $visitTreatment) {
            if (!$this->isImplantTreatment($visitTreatment)) {
                continue;
            }

            $date = $this->parseDate($this->dateString($visitTreatment->visit?->visit_date ?? $visitTreatment->created_at));
            if ($date === null) {
                continue;
            }

            $bucket = $this->monthBucket($date);
            $grouped[$bucket['key']] ??= ['count' => 0, 'key' => $bucket['key'], 'label' => $bucket['label'], 'revenue' => 0.0, 'sort' => $bucket['sort']];
            $grouped[$bucket['key']]['count'] += 1;
            $grouped[$bucket['key']]['revenue'] = $this->toTwoDecimals($grouped[$bucket['key']]['revenue'] + $this->toFloat($visitTreatment->price ?? 0));
        }

        $rows = array_values($grouped);
        usort($rows, static fn (array $left, array $right): int => $left['sort'] <=> $right['sort']);

        return array_map(static fn (array $row): array => [
            'count' => $row['count'],
            'key' => $row['key'],
            'label' => $row['label'],
            'revenue' => $row['revenue'],
        ], $rows);
    }

    private function buildProfitLossTrend(Collection $filteredPayments, Collection $dailyExpenses, Collection $clinicalExpenses, Collection $salaryPayments, string $granularity): array
    {
        $buckets = [];

        foreach ($filteredPayments as $payment) {
            $date = $this->parseDate((string) $payment['date']);
            if ($date === null) {
                continue;
            }

            $bucket = $this->bucket($date, $granularity);
            $buckets[$bucket['key']] ??= ['income' => 0.0, 'key' => $bucket['key'], 'label' => $bucket['label'], 'outcome' => 0.0, 'sort' => $bucket['sort']];
            $buckets[$bucket['key']]['income'] = $this->toTwoDecimals($buckets[$bucket['key']]['income'] + (float) $payment['amount']);
        }

        foreach ($dailyExpenses->concat($clinicalExpenses) as $expense) {
            $date = $this->parseDate($this->dateString($expense->expense_date));
            if ($date === null) {
                continue;
            }

            $bucket = $this->bucket($date, $granularity);
            $buckets[$bucket['key']] ??= ['income' => 0.0, 'key' => $bucket['key'], 'label' => $bucket['label'], 'outcome' => 0.0, 'sort' => $bucket['sort']];
            $buckets[$bucket['key']]['outcome'] = $this->toTwoDecimals($buckets[$bucket['key']]['outcome'] + $this->toFloat($expense->amount ?? 0));
        }

        foreach ($salaryPayments as $salaryPayment) {
            if (!\in_array((string) $salaryPayment->status, ['paid', 'partial'], true)) {
                continue;
            }

            $date = $this->parseDate($this->dateString($salaryPayment->payment_date));
            if ($date === null) {
                continue;
            }

            $bucket = $this->bucket($date, $granularity);
            $buckets[$bucket['key']] ??= ['income' => 0.0, 'key' => $bucket['key'], 'label' => $bucket['label'], 'outcome' => 0.0, 'sort' => $bucket['sort']];
            $buckets[$bucket['key']]['outcome'] = $this->toTwoDecimals($buckets[$bucket['key']]['outcome'] + $this->toFloat($salaryPayment->net_amount ?? 0));
        }

        $rows = array_values($buckets);
        usort($rows, static fn (array $left, array $right): int => $left['sort'] <=> $right['sort']);

        return array_map(fn (array $row): array => [
            'income' => $row['income'],
            'key' => $row['key'],
            'label' => $row['label'],
            'outcome' => $row['outcome'],
            'profit' => $this->toTwoDecimals($row['income'] - $row['outcome']),
        ], $rows);
    }

    private function buildRevenueTrend(Collection $filteredPayments): array
    {
        $grouped = [];

        foreach ($filteredPayments as $payment) {
            $date = $this->parseDate((string) $payment['date']);
            if ($date === null) {
                continue;
            }

            $bucket = $this->monthBucket($date);
            $grouped[$bucket['key']] ??= ['amount' => 0.0, 'key' => $bucket['key'], 'label' => $bucket['label'], 'sort' => $bucket['sort']];
            $grouped[$bucket['key']]['amount'] = $this->toTwoDecimals($grouped[$bucket['key']]['amount'] + (float) $payment['amount']);
        }

        $rows = array_values($grouped);
        usort($rows, static fn (array $left, array $right): int => $left['sort'] <=> $right['sort']);

        return array_map(static fn (array $row): array => [
            'amount' => $row['amount'],
            'key' => $row['key'],
            'label' => $row['label'],
        ], $rows);
    }

    private function buildThirdCompanySummary(Collection $tasks, string $patientFilter, string $statusFilter): array
    {
        $rowsByToothKey = [];
        $currencySummary = [
            'AFN' => ['paid' => 0.0, 'unpaid' => 0.0],
            'USD' => ['paid' => 0.0, 'unpaid' => 0.0],
        ];

        foreach ($tasks as $task) {
            if (!$this->isImplantTask($task)) {
                continue;
            }

            $patientId = (string) ($task->patient_id ?? '');
            if ($patientFilter !== '' && $patientId !== $patientFilter) {
                continue;
            }

            $availability = $this->taskAvailability((string) ($task->notes ?? ''), (string) ($task->status ?? 'pending'));
            if ($statusFilter !== '' && $this->taskStatusToReportStatus($availability) !== $statusFilter) {
                continue;
            }

            $toothNumber = $this->implantToothNumber((string) ($task->notes ?? ''), (string) ($task->title ?? ''));
            if ($toothNumber === null) {
                continue;
            }

            $supplierTotal = $this->taggedAmount((string) ($task->notes ?? ''), 'supplier_total');
            $supplierPaid = min($supplierTotal, $this->taggedAmount((string) ($task->notes ?? ''), 'supplier_paid'));
            $currency = $this->currencyCode($this->taggedText((string) ($task->notes ?? ''), 'currency'));
            $exchangeRate = $this->toFloat($this->taggedText((string) ($task->notes ?? ''), 'exchangeRate')) ?: 1.0;
            $supplierTotalInput = $this->taggedInputAmount((string) ($task->notes ?? ''), 'supplier_total_input', 'supplier_total', $currency, $exchangeRate);
            $supplierPaidInput = min(
                $supplierTotalInput,
                $this->taggedInputAmount((string) ($task->notes ?? ''), 'supplier_paid_input', 'supplier_paid', $currency, $exchangeRate)
            );
            $row = [
                'createdAt' => $this->dateString($task->created_at),
                'currency' => $currency,
                'patientId' => $patientId,
                'supplierPaid' => $this->toTwoDecimals($supplierPaid),
                'supplierPaidInput' => $this->toTwoDecimals($supplierPaidInput),
                'supplierRemaining' => $this->toTwoDecimals(max(0, $supplierTotal - $supplierPaid)),
                'supplierRemainingInput' => $this->toTwoDecimals(max(0, $supplierTotalInput - $supplierPaidInput)),
                'supplierTotal' => $this->toTwoDecimals($supplierTotal),
                'supplierTotalInput' => $this->toTwoDecimals($supplierTotalInput),
                'taskId' => (string) $task->id,
                'toothNumber' => $toothNumber,
            ];

            $key = "{$patientId}:{$toothNumber}";
            $previous = $rowsByToothKey[$key] ?? null;
            if ($previous === null || $this->compareImplantRows($previous, $row) <= 0) {
                $rowsByToothKey[$key] = $row;
            }
        }

        $rows = array_values($rowsByToothKey);
        foreach ($rows as $row) {
            $currency = $this->currencyCode($row['currency'] ?? 'AFN');
            $currencySummary[$currency]['paid'] = $this->toTwoDecimals($currencySummary[$currency]['paid'] + (float) ($row['supplierPaidInput'] ?? 0));
            $currencySummary[$currency]['unpaid'] = $this->toTwoDecimals($currencySummary[$currency]['unpaid'] + (float) ($row['supplierRemainingInput'] ?? 0));
        }
        $totalSupplierCost = $this->toTwoDecimals(array_sum(array_column($rows, 'supplierTotal')));
        $totalPaid = $this->toTwoDecimals(array_sum(array_column($rows, 'supplierPaid')));
        $totalUnpaid = $this->toTwoDecimals(array_sum(array_column($rows, 'supplierRemaining')));

        return [
            'currencySummary' => $currencySummary,
            'totalPaid' => $totalPaid,
            'totalSupplierCost' => $totalSupplierCost,
            'totalUnpaid' => $totalUnpaid,
            'unpaidCount' => count(array_filter($rows, static fn (array $row): bool => $row['supplierRemaining'] > 0)),
        ];
    }

    private function buildTreatmentVolume(Collection $filteredVisitTreatments): array
    {
        $grouped = [];

        foreach ($filteredVisitTreatments as $visitTreatment) {
            $name = $this->treatmentName($visitTreatment);
            $grouped[$name] ??= ['name' => $name, 'revenue' => 0.0, 'sessions' => 0];
            $grouped[$name]['sessions'] += 1;
            $grouped[$name]['revenue'] = $this->toTwoDecimals($grouped[$name]['revenue'] + $this->toFloat($visitTreatment->price ?? 0));
        }

        $rows = array_values($grouped);
        usort($rows, static fn (array $left, array $right): int => ($right['revenue'] <=> $left['revenue']) ?: ($right['sessions'] <=> $left['sessions']));

        return $rows;
    }

    private function bucket(CarbonImmutable $date, string $granularity): array
    {
        if ($granularity === 'month') {
            return $this->monthBucket($date);
        }

        if ($granularity === 'year') {
            return [
                'key' => $date->format('Y'),
                'label' => $date->format('Y'),
                'sort' => $date->startOfYear()->getTimestampMs(),
            ];
        }

        return [
            'key' => $date->format('Y-m-d'),
            'label' => $date->format('M j'),
            'sort' => $date->startOfDay()->getTimestampMs(),
        ];
    }

    private function compareImplantRows(array $left, array $right): int
    {
        $leftCreated = $this->parseDate($left['createdAt'])?->getTimestampMs() ?? PHP_INT_MIN;
        $rightCreated = $this->parseDate($right['createdAt'])?->getTimestampMs() ?? PHP_INT_MIN;
        if ($leftCreated !== $rightCreated) {
            return $leftCreated <=> $rightCreated;
        }

        return (int) ($left['taskId'] ?? 0) <=> (int) ($right['taskId'] ?? 0);
    }

    private function dateString(mixed $value): string
    {
        if ($value instanceof CarbonImmutable) {
            return $value->toDateString();
        }
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        return trim((string) ($value ?? ''));
    }

    private function dateWithin(mixed $value, CarbonImmutable $startDate, CarbonImmutable $endDate): bool
    {
        $date = $this->parseDate($this->dateString($value));
        return $date !== null && !$date->lt($startDate) && !$date->gt($endDate);
    }

    private function dentistName(?string $fullName, mixed $dentistId): string
    {
        $name = trim((string) ($fullName ?? ''));
        if ($name !== '') {
            return $name;
        }

        $id = trim((string) ($dentistId ?? ''));
        return $id !== '' ? "Dentist #{$id}" : '';
    }

    private function implantToothNumber(string $notes, string $title): ?string
    {
        if (preg_match('/\[implant_tooth:([0-9]{2})\]/i', $notes, $notesMatch) === 1 && isset($notesMatch[1])) {
            return $notesMatch[1];
        }
        if (preg_match('/([0-9]{2})/', $title, $titleMatch) === 1 && isset($titleMatch[1])) {
            return $titleMatch[1];
        }

        return null;
    }

    private function isImplantTask(PatientSessionTask $task): bool
    {
        $notes = mb_strtolower((string) ($task->notes ?? ''));
        return str_contains($notes, 'implant_tooth')
            || str_contains(mb_strtolower((string) ($task->title ?? '')), 'implant tooth');
    }

    private function isImplantTreatment(VisitTreatment $visitTreatment): bool
    {
        $treatmentName = mb_strtolower((string) ($visitTreatment->treatment?->name ?? ''));
        if (str_contains($treatmentName, 'implant')) {
            return true;
        }

        $category = mb_strtolower((string) ($visitTreatment->treatment?->category ?? ''));
        $notes = mb_strtolower((string) ($visitTreatment->notes ?? ''));

        return str_contains($category, 'implant')
            || str_contains($notes, '[condition:implant]')
            || preg_match('/\bimplant\b/i', $notes) === 1;
    }

    private function matchesDentistFilter(string $dentistFilter, ?string $dentistName, mixed $dentistId): bool
    {
        if ($dentistFilter === '') {
            return true;
        }

        return mb_strtolower($this->dentistName($dentistName, $dentistId)) === mb_strtolower($dentistFilter)
            || trim((string) ($dentistId ?? '')) === $dentistFilter;
    }

    private function monthBucket(CarbonImmutable $date): array
    {
        return [
            'key' => $date->format('Y-m'),
            'label' => $date->format('M Y'),
            'sort' => $date->startOfMonth()->getTimestampMs(),
        ];
    }

    private function normalizeFilter(string $value): string
    {
        $trimmed = trim($value);
        return $trimmed === 'all' ? '' : $trimmed;
    }

    private function normalizeGranularity(string $value): string
    {
        return \in_array($value, ['day', 'month', 'year'], true) ? $value : 'day';
    }

    private function parseDate(string $value): ?CarbonImmutable
    {
        if ($value === '') {
            return null;
        }

        try {
            return CarbonImmutable::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    private function patientName(Patient $patient): string
    {
        $fullName = trim(sprintf('%s %s', (string) ($patient->first_name ?? ''), (string) ($patient->last_name ?? '')));
        if ($fullName !== '') {
            return $fullName;
        }

        $patientCode = trim((string) ($patient->patient_code ?? ''));
        return $patientCode !== '' ? $patientCode : "Patient #{$patient->id}";
    }

    private function stringOrFallback(mixed $value, string $fallback): string
    {
        $trimmed = trim((string) ($value ?? ''));
        return $trimmed !== '' ? $trimmed : $fallback;
    }

    private function taggedAmount(string $notes, string $key): float
    {
        if (preg_match("/\\[{$key}:([0-9]+(?:\\.[0-9]+)?)\\]/i", $notes, $matches) !== 1 || !isset($matches[1])) {
            return 0.0;
        }

        return max(0, (float) $matches[1]);
    }

    private function taskAvailability(string $notes, string $status): string
    {
        if (preg_match('/\[implant_availability:(not_available|in_purchase|available|done)\]/i', $notes, $matches) === 1 && isset($matches[1])) {
            return mb_strtolower($matches[1]);
        }

        return match (mb_strtolower($status)) {
            'done' => 'done',
            'in_progress' => 'available',
            default => 'not_available',
        };
    }

    private function taskStatusToReportStatus(string $availability): string
    {
        return $availability === 'done' ? 'completed' : 'pending';
    }

    private function taggedInputAmount(string $notes, string $inputKey, string $baseKey, string $currency, float $exchangeRate): float
    {
        $inputValue = $this->taggedText($notes, $inputKey);
        if ($inputValue !== '') {
            return $this->toTwoDecimals((float) $inputValue);
        }

        return $this->convertBaseAmountToInputCurrency($this->taggedAmount($notes, $baseKey), $currency, $exchangeRate);
    }

    private function taggedText(string $notes, string $key): string
    {
        if (preg_match("/\\[{$key}:([^\\]]+)\\]/i", $notes, $matches) !== 1 || !isset($matches[1])) {
            return '';
        }

        return trim((string) $matches[1]);
    }

    private function toFloat(mixed $value): float
    {
        return round((float) ($value ?? 0), 2);
    }

    private function toReportStatus(string $value): string
    {
        return match (mb_strtolower($value)) {
            'cancelled' => 'cancelled',
            'paid', 'completed', 'done' => 'completed',
            default => 'pending',
        };
    }

    private function toTwoDecimals(float $value): float
    {
        return round($value, 2);
    }

    private function treatmentName(VisitTreatment $visitTreatment): string
    {
        $name = trim((string) ($visitTreatment->treatment?->name ?? ''));
        if ($name !== '') {
            return $name;
        }

        $id = trim((string) ($visitTreatment->treatment_id ?? ''));
        return $id !== '' ? "Treatment {$id}" : 'Unknown Treatment';
    }
}
