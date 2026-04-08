<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\DentalManagement\Domain\Entities\Debt;
use App\Modules\DentalManagement\Domain\Entities\Expense;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Domain\Entities\SalaryPayment;
use App\Modules\DentalManagement\Domain\Entities\Shareholder;
use App\Modules\DentalManagement\Domain\Entities\ShareholderTransaction;
use App\Modules\DentalManagement\Domain\Services\Concerns\InteractsWithReportData;
use Carbon\CarbonImmutable;

final class ReportSubpageService
{
    use InteractsWithReportData;

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function dailyExpenses(array $filters): array
    {
        [$startDate, $endDate] = $this->resolveDateRange($filters);
        $categoryFilter = $this->normalizedFilter($filters, 'category');
        $staffId = (int) ($filters['staffId'] ?? 0);
        $search = mb_strtolower($this->text($filters['search'] ?? ''));
        $currencySections = $this->initializeCurrencySections([
            'allTotal',
            'monthTotal',
            'todayTotal',
        ]);

        $rows = Expense::query()
            ->with('staff:id,full_name')
            ->where('expense_type', 'daily')
            ->where('expense_date', '>=', $startDate->toDateString())
            ->where('expense_date', '<=', $endDate->toDateString())
            ->orderByDesc('expense_date')
            ->orderByDesc('id')
            ->get()
            ->map(function (Expense $expense): array {
                $currency = $this->currencyCode($expense->currency);
                $amount = $this->decimal($expense->amount ?? 0);

                return [
                    'amount' => $amount,
                    'amountInput' => $this->resolveInputAmount($expense->amount_input, $expense->amount, $currency, $expense->exchange_rate),
                    'category' => $this->text($expense->category, 'Other'),
                    'createdAt' => $this->dateTimeString($expense->created_at),
                    'currency' => $currency,
                    'expenseDate' => $this->dateString($expense->expense_date),
                    'exchangeRate' => $this->decimal($expense->exchange_rate ?? 1) ?: 1.0,
                    'id' => (int) $expense->id,
                    'method' => $this->text($expense->payment_method, 'cash'),
                    'notes' => $this->text($expense->notes),
                    'staffId' => (int) ($expense->staff_id ?? 0),
                    'staffName' => $this->text($expense->staff?->full_name, $expense->staff_id ? "Staff #{$expense->staff_id}" : ''),
                    'title' => $this->text($expense->title),
                ];
            })
            ->filter(function (array $row) use ($categoryFilter, $search, $staffId): bool {
                if ($categoryFilter !== '' && mb_strtolower($row['category']) !== mb_strtolower($categoryFilter)) {
                    return false;
                }
                if ($staffId > 0 && (int) $row['staffId'] !== $staffId) {
                    return false;
                }
                if ($search !== '') {
                    $haystack = mb_strtolower(implode(' ', [$row['title'], $row['notes'], $row['category'], $row['staffName']]));
                    if (!str_contains($haystack, $search)) {
                        return false;
                    }
                }

                return true;
            })
            ->values()
            ->all();

        $today = CarbonImmutable::now()->toDateString();
        $monthToken = CarbonImmutable::now()->format('Y-m');

        $allTotal = 0.0;
        $monthTotal = 0.0;
        $todayTotal = 0.0;
        foreach ($rows as $row) {
            $amount = (float) ($row['amount'] ?? 0);
            $amountInput = (float) ($row['amountInput'] ?? 0);
            $currency = $row['currency'] ?? 'AFN';

            $allTotal += $amount;
            $this->addCurrencySectionValue($currencySections, $currency, 'allTotal', $amountInput);

            if (str_starts_with((string) $row['expenseDate'], $monthToken)) {
                $monthTotal += $amount;
                $this->addCurrencySectionValue($currencySections, $currency, 'monthTotal', $amountInput);
            }

            if ($row['expenseDate'] === $today) {
                $todayTotal += $amount;
                $this->addCurrencySectionValue($currencySections, $currency, 'todayTotal', $amountInput);
            }
        }

        $summary = [
            'allTotal' => $this->decimal($allTotal),
            'currencySections' => $currencySections,
            'monthTotal' => $this->decimal($monthTotal),
            'todayTotal' => $this->decimal($todayTotal),
        ];

        $grouped = [];
        foreach ($rows as $row) {
            $date = (string) $row['expenseDate'];
            $grouped[$date] = $this->decimal(($grouped[$date] ?? 0) + (float) ($row['amount'] ?? 0));
        }
        ksort($grouped);

        return [
            'summary' => $summary,
            'chart' => array_slice(array_map(
                static fn (string $date, float $amount): array => ['amount' => $amount, 'date' => $date],
                array_keys($grouped),
                array_values($grouped)
            ), -14),
            'history' => $this->paginateRows(
                $this->sortRows($rows, (string) ($filters['sortBy'] ?? 'expenseDate'), (string) ($filters['sortDirection'] ?? 'desc')),
                (int) ($filters['page'] ?? 1),
                (int) ($filters['perPage'] ?? 10),
            ),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function clinicalExpenses(array $filters): array
    {
        [$startDate, $endDate] = $this->resolveDateRange($filters);
        $categoryFilter = $this->normalizedFilter($filters, 'category');
        $staffId = (int) ($filters['staffId'] ?? 0);
        $search = mb_strtolower($this->text($filters['search'] ?? ''));
        $currencySections = $this->initializeCurrencySections([
            'totalSpend',
        ]);

        $rows = Expense::query()
            ->with('staff:id,full_name')
            ->where('expense_type', 'clinical')
            ->where('expense_date', '>=', $startDate->toDateString())
            ->where('expense_date', '<=', $endDate->toDateString())
            ->orderByDesc('expense_date')
            ->orderByDesc('id')
            ->get()
            ->map(function (Expense $expense): array {
                $currency = $this->currencyCode($expense->currency);
                $amount = $this->decimal($expense->amount ?? 0);

                return [
                    'amount' => $amount,
                    'amountInput' => $this->resolveInputAmount($expense->amount_input, $expense->amount, $currency, $expense->exchange_rate),
                    'category' => $this->text($expense->category, 'Other'),
                    'createdAt' => $this->dateTimeString($expense->created_at),
                    'currency' => $currency,
                    'expenseDate' => $this->dateString($expense->expense_date),
                    'exchangeRate' => $this->decimal($expense->exchange_rate ?? 1) ?: 1.0,
                    'id' => (int) $expense->id,
                    'itemName' => $this->text($expense->title),
                    'notes' => $this->text($expense->notes),
                    'quantity' => (int) ($expense->quantity ?? 1),
                    'staffId' => (int) ($expense->staff_id ?? 0),
                    'staffName' => $this->text($expense->staff?->full_name, $expense->staff_id ? "Staff #{$expense->staff_id}" : ''),
                    'unitCost' => $this->decimal($expense->unit_cost ?? $expense->amount ?? 0),
                    'unitCostInput' => $this->resolveInputAmount($expense->unit_cost_input, $expense->unit_cost ?? $expense->amount, $currency, $expense->exchange_rate),
                    'vendor' => $this->text($expense->vendor),
                ];
            })
            ->filter(function (array $row) use ($categoryFilter, $search, $staffId): bool {
                if ($categoryFilter !== '' && mb_strtolower($row['category']) !== mb_strtolower($categoryFilter)) {
                    return false;
                }
                if ($staffId > 0 && (int) $row['staffId'] !== $staffId) {
                    return false;
                }
                if ($search !== '') {
                    $haystack = mb_strtolower(implode(' ', [$row['itemName'], $row['notes'], $row['vendor'], $row['category'], $row['staffName']]));
                    if (!str_contains($haystack, $search)) {
                        return false;
                    }
                }

                return true;
            })
            ->values()
            ->all();

        $byCategory = [];
        $totalSpend = 0.0;
        foreach ($rows as $row) {
            $category = (string) $row['category'];
            $byCategory[$category] ??= ['category' => $category, 'amount' => 0.0];
            $byCategory[$category]['amount'] = $this->decimal($byCategory[$category]['amount'] + (float) ($row['amount'] ?? 0));
            $totalSpend += (float) ($row['amount'] ?? 0);
            $this->addCurrencySectionValue($currencySections, $row['currency'] ?? 'AFN', 'totalSpend', $row['amountInput'] ?? 0);
        }

        return [
            'summary' => [
                'currencySections' => $currencySections,
                'recordCount' => count($rows),
                'totalSpend' => $this->decimal($totalSpend),
            ],
            'breakdown' => $this->sortRows(array_values($byCategory), 'amount'),
            'history' => $this->paginateRows(
                $this->sortRows($rows, (string) ($filters['sortBy'] ?? 'expenseDate'), (string) ($filters['sortDirection'] ?? 'desc')),
                (int) ($filters['page'] ?? 1),
                (int) ($filters['perPage'] ?? 10),
            ),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function debts(array $filters): array
    {
        [$startDate, $endDate] = $this->resolveDateRange($filters);
        $patientFilter = $this->normalizedFilter($filters, 'patientFilter');
        $invoiceId = $this->text($filters['invoiceId'] ?? '');
        $agingBucket = $this->normalizedFilter($filters, 'debtAgingBucket');
        $search = mb_strtolower($this->text($filters['search'] ?? ''));
        $currencySections = $this->initializeCurrencySections([
            'totalDebt',
            'totalNet',
            'totalPaid',
        ]);

        $rows = Debt::query()
            ->with([
                'invoice:id,currency,exchange_rate,net_amount,net_amount_input',
                'patient:id,patient_code,first_name,last_name',
            ])
            ->where('debt_amount', '>', 0)
            ->whereHas('invoice', function ($query): void {
                $query->whereIn('status', ['unpaid', 'partially_paid']);
            })
            ->where('invoice_date', '>=', $startDate->toDateString())
            ->where('invoice_date', '<=', $endDate->toDateString())
            ->orderByDesc('invoice_date')
            ->get()
            ->map(function (Debt $debt): array {
                $invoiceDate = $this->dateString($debt->invoice_date);
                $agingDays = (int) round($this->parseDate($invoiceDate)?->diffInDays(CarbonImmutable::now()) ?? 0);
                $currency = $this->currencyCode($debt->invoice?->currency ?? $debt->currency);
                $exchangeRate = $this->decimal($debt->invoice?->exchange_rate ?? 1) ?: 1.0;
                $netAmount = $this->decimal($debt->net_amount ?? $debt->invoice?->net_amount ?? 0);
                $paidAmount = $this->decimal($debt->paid_amount ?? 0);
                $debtAmount = $this->decimal($debt->debt_amount ?? max(0, $netAmount - $paidAmount));

                return [
                    'agingBucket' => $this->agingBucket($agingDays),
                    'currency' => $currency,
                    'debtAmount' => $debtAmount,
                    'debtAmountInput' => $this->convertBaseAmountToInputCurrency($debtAmount, $currency, $exchangeRate),
                    'exchangeRate' => $exchangeRate,
                    'id' => (int) $debt->id,
                    'invoiceDate' => $invoiceDate,
                    'invoiceId' => (string) ($debt->invoice_id ?? ''),
                    'netAmount' => $netAmount,
                    'netAmountInput' => $this->resolveInputAmount($debt->invoice?->net_amount_input, $netAmount, $currency, $exchangeRate),
                    'paidAmount' => $paidAmount,
                    'paidAmountInput' => $this->convertBaseAmountToInputCurrency($paidAmount, $currency, $exchangeRate),
                    'patientId' => (string) ($debt->patient_id ?? ''),
                    'patientName' => $this->patientName($debt->patient, $debt->patient_id),
                    'status' => $this->text($debt->status, 'open'),
                ];
            })
            ->filter(function (array $row) use ($agingBucket, $invoiceId, $patientFilter, $search): bool {
                if ($patientFilter !== '' && (string) $row['patientId'] !== $patientFilter) {
                    return false;
                }
                if ($invoiceId !== '' && !str_contains((string) $row['invoiceId'], $invoiceId)) {
                    return false;
                }
                if ($agingBucket !== '' && $row['agingBucket'] !== $agingBucket) {
                    return false;
                }
                if ($search !== '') {
                    $haystack = mb_strtolower(implode(' ', [$row['invoiceId'], $row['patientName'], $row['status']]));
                    if (!str_contains($haystack, $search)) {
                        return false;
                    }
                }

                return true;
            })
            ->values()
            ->all();

        $patientDebtTotals = [];
        foreach ($rows as $row) {
            $patientId = (string) ($row['patientId'] ?? '');
            if ($patientId === '') {
                continue;
            }
            $patientDebtTotals[$patientId] = $this->decimal(
                ($patientDebtTotals[$patientId] ?? 0) + (float) ($row['debtAmount'] ?? 0)
            );
        }

        $totalPatientDebt = $this->decimal(array_sum($patientDebtTotals));

        $rows = array_map(function (array $row) use ($patientDebtTotals): array {
            $patientId = (string) ($row['patientId'] ?? '');
            $row['patientDebtAmount'] = $this->decimal(
                $patientId !== '' ? ($patientDebtTotals[$patientId] ?? 0) : ($row['debtAmount'] ?? 0)
            );

            return $row;
        }, $rows);

        $agingBreakdown = [];
        foreach ($rows as $row) {
            $bucket = (string) $row['agingBucket'];
            $agingBreakdown[$bucket] ??= ['amount' => 0.0, 'bucket' => $bucket, 'count' => 0];
            $agingBreakdown[$bucket]['amount'] = $this->decimal($agingBreakdown[$bucket]['amount'] + (float) $row['debtAmount']);
            $agingBreakdown[$bucket]['count'] += 1;
            $this->addCurrencySectionValue($currencySections, $row['currency'] ?? 'AFN', 'totalDebt', $row['debtAmountInput'] ?? 0);
            $this->addCurrencySectionValue($currencySections, $row['currency'] ?? 'AFN', 'totalNet', $row['netAmountInput'] ?? 0);
            $this->addCurrencySectionValue($currencySections, $row['currency'] ?? 'AFN', 'totalPaid', $row['paidAmountInput'] ?? 0);
        }

        return [
            'summary' => [
                'debtCount' => count($rows),
                'currencySections' => $currencySections,
                'totalDebt' => $totalPatientDebt,
                'totalNet' => $this->decimal(array_sum(array_column($rows, 'netAmount'))),
                'totalPaid' => $this->decimal(array_sum(array_column($rows, 'paidAmount'))),
            ],
            'aging' => array_values($agingBreakdown),
            'rows' => $this->paginateRows(
                $this->sortRows($rows, (string) ($filters['sortBy'] ?? 'invoiceDate'), (string) ($filters['sortDirection'] ?? 'desc')),
                (int) ($filters['page'] ?? 1),
                (int) ($filters['perPage'] ?? 10),
            ),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function safe(array $filters): array
    {
        [$startDate, $endDate] = $this->resolveDateRange($filters);
        $direction = $this->normalizedFilter($filters, 'direction');
        $entryType = $this->normalizedFilter($filters, 'entryType');
        $staffId = (int) ($filters['staffId'] ?? 0);
        $search = mb_strtolower($this->text($filters['search'] ?? ''));
        $currencySections = $this->initializeCurrencySections([
            'balance',
            'previousBalance',
            'rangeNet',
            'totalIn',
            'totalOut',
        ]);

        $rows = SafeTransaction::query()
            ->with('pickedByStaff:id,full_name')
            ->where('transaction_date', '>=', $startDate->toDateString())
            ->where('transaction_date', '<=', $endDate->toDateString())
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->get()
            ->map(function (SafeTransaction $row): array {
                $currency = $this->currencyCode($row->currency);
                $amount = $this->decimal($row->amount ?? 0);

                return [
                    'amount' => $amount,
                    'amountInput' => $this->resolveInputAmount($row->amount_input, $row->amount, $currency, $row->exchange_rate),
                    'createdAt' => $this->dateTimeString($row->created_at),
                    'currency' => $currency,
                    'direction' => $this->text($row->direction, 'in'),
                    'entryType' => $this->text($row->entry_type, 'adjustment'),
                    'exchangeRate' => $this->decimal($row->exchange_rate ?? 1) ?: 1.0,
                    'id' => (int) $row->id,
                    'notes' => $this->text($row->notes),
                    'pickedByStaffId' => (int) ($row->picked_by_staff_id ?? 0),
                    'pickedByStaffName' => $this->text($row->pickedByStaff?->full_name, $row->picked_by_staff_id ? "Staff #{$row->picked_by_staff_id}" : ''),
                    'sourceType' => $this->text($row->source_type),
                    'transactionDate' => $this->dateString($row->transaction_date),
                ];
            })
            ->filter(function (array $row) use ($direction, $entryType, $search, $staffId): bool {
                if ($direction !== '' && $row['direction'] !== $direction) {
                    return false;
                }
                if ($entryType !== '' && mb_strtolower($row['entryType']) !== mb_strtolower($entryType)) {
                    return false;
                }
                if ($staffId > 0 && (int) $row['pickedByStaffId'] !== $staffId) {
                    return false;
                }
                if ($search !== '') {
                    $haystack = mb_strtolower(implode(' ', [$row['notes'], $row['entryType'], $row['pickedByStaffName']]));
                    if (!str_contains($haystack, $search)) {
                        return false;
                    }
                }

                return true;
            })
            ->values()
            ->all();

        $totalIn = 0.0;
        $totalOut = 0.0;
        foreach ($rows as $row) {
            if ($row['direction'] === 'out') {
                $totalOut += (float) $row['amount'];
                $this->addCurrencySectionValue($currencySections, $row['currency'] ?? 'AFN', 'totalOut', $row['amountInput']);
            } else {
                $totalIn += (float) $row['amount'];
                $this->addCurrencySectionValue($currencySections, $row['currency'] ?? 'AFN', 'totalIn', $row['amountInput']);
            }
        }

        $balanceRows = SafeTransaction::query()
            ->select(['transaction_date', 'direction', 'amount', 'amount_input', 'currency', 'exchange_rate'])
            ->where('transaction_date', '<=', $endDate->toDateString())
            ->get();

        $balanceIn = 0.0;
        $balanceOut = 0.0;
        $previousBalanceIn = 0.0;
        $previousBalanceOut = 0.0;

        foreach ($balanceRows as $balanceRow) {
            $currency = $this->currencyCode($balanceRow->currency);
            $amount = $this->decimal($balanceRow->amount ?? 0);
            $amountInput = $this->resolveInputAmount($balanceRow->amount_input, $balanceRow->amount, $currency, $balanceRow->exchange_rate);
            $isOut = $this->text($balanceRow->direction, 'in') === 'out';
            $transactionDate = $this->dateString($balanceRow->transaction_date);

            if ($isOut) {
                $balanceOut += $amount;
                $this->addCurrencySectionValue($currencySections, $currency, 'balance', -$amountInput);
            } else {
                $balanceIn += $amount;
                $this->addCurrencySectionValue($currencySections, $currency, 'balance', $amountInput);
            }

            if ($transactionDate < $startDate->toDateString()) {
                if ($isOut) {
                    $previousBalanceOut += $amount;
                    $this->addCurrencySectionValue($currencySections, $currency, 'previousBalance', -$amountInput);
                } else {
                    $previousBalanceIn += $amount;
                    $this->addCurrencySectionValue($currencySections, $currency, 'previousBalance', $amountInput);
                }
            }
        }

        foreach (['AFN', 'USD'] as $currency) {
            $currencySections[$currency]['rangeNet'] = $this->decimal(
                ($currencySections[$currency]['totalIn'] ?? 0) - ($currencySections[$currency]['totalOut'] ?? 0)
            );
            $currencySections[$currency]['balance'] = $this->decimal($currencySections[$currency]['balance'] ?? 0);
            $currencySections[$currency]['previousBalance'] = $this->decimal($currencySections[$currency]['previousBalance'] ?? 0);
        }

        return [
            'summary' => [
                'balance' => $this->decimal($balanceIn - $balanceOut),
                'currencySections' => $currencySections,
                'previousBalance' => $this->decimal($previousBalanceIn - $previousBalanceOut),
                'rangeNet' => $this->decimal($totalIn - $totalOut),
                'totalIn' => $this->decimal($totalIn),
                'totalOut' => $this->decimal($totalOut),
            ],
            'ledger' => $this->paginateRows(
                $this->sortRows($rows, (string) ($filters['sortBy'] ?? 'transactionDate'), (string) ($filters['sortDirection'] ?? 'desc')),
                (int) ($filters['page'] ?? 1),
                (int) ($filters['perPage'] ?? 10),
            ),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function salaries(array $filters): array
    {
        [$startDate, $endDate] = $this->resolveDateRange($filters);
        $staffId = (int) ($filters['staffId'] ?? 0);
        $status = $this->normalizedFilter($filters, 'statusFilter');
        $search = mb_strtolower($this->text($filters['search'] ?? ''));
        $currencySections = $this->initializeCurrencySections([
            'paidTotal',
        ]);

        $rows = SalaryPayment::query()
            ->with('staff:id,full_name')
            ->where('payment_date', '>=', $startDate->toDateString())
            ->where('payment_date', '<=', $endDate->toDateString())
            ->orderByDesc('payment_date')
            ->get()
            ->map(function (SalaryPayment $payment): array {
                $currency = $this->currencyCode($payment->currency);
                $netAmount = $this->decimal($payment->net_amount ?? 0);

                return [
                    'createdAt' => $this->dateTimeString($payment->created_at),
                    'currency' => $currency,
                    'exchangeRate' => $this->decimal($payment->exchange_rate ?? 1) ?: 1.0,
                    'id' => (int) $payment->id,
                    'netAmount' => $netAmount,
                    'netAmountInput' => $this->resolveInputAmount($payment->net_amount_input, $payment->net_amount, $currency, $payment->exchange_rate),
                    'paymentDate' => $this->dateString($payment->payment_date),
                    'salaryMonth' => $this->text($payment->salary_month),
                    'staffId' => (int) ($payment->staff_id ?? 0),
                    'staffName' => $this->text($payment->staff?->full_name, $payment->staff_id ? "Staff #{$payment->staff_id}" : ''),
                    'status' => $this->text($payment->status, 'pending'),
                ];
            })
            ->filter(function (array $row) use ($search, $staffId, $status): bool {
                if ($staffId > 0 && (int) $row['staffId'] !== $staffId) {
                    return false;
                }
                if ($status !== '' && $this->reportStatus((string) $row['status']) !== $status) {
                    return false;
                }
                if ($search !== '') {
                    $haystack = mb_strtolower(implode(' ', [$row['salaryMonth'], $row['staffName'], $row['status']]));
                    if (!str_contains($haystack, $search)) {
                        return false;
                    }
                }

                return true;
            })
            ->values()
            ->all();

        $paidTotal = 0.0;
        $pendingCount = 0;
        foreach ($rows as $row) {
            if (in_array((string) $row['status'], ['paid', 'partial'], true)) {
                $paidTotal += (float) ($row['netAmount'] ?? 0);
                $this->addCurrencySectionValue($currencySections, $row['currency'] ?? 'AFN', 'paidTotal', $row['netAmountInput'] ?? 0);
            }
            if ((string) $row['status'] === 'pending') {
                $pendingCount++;
            }
        }

        return [
            'summary' => [
                'currencySections' => $currencySections,
                'paidTotal' => $this->decimal($paidTotal),
                'pendingCount' => $pendingCount,
                'totalCount' => count($rows),
            ],
            'rows' => $this->paginateRows(
                $this->sortRows($rows, (string) ($filters['sortBy'] ?? 'paymentDate'), (string) ($filters['sortDirection'] ?? 'desc')),
                (int) ($filters['page'] ?? 1),
                (int) ($filters['perPage'] ?? 10),
            ),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function shareholders(array $filters): array
    {
        [$startDate, $endDate] = $this->resolveDateRange($filters);
        $shareholderId = (int) ($filters['shareholderId'] ?? 0);
        $transactionType = $this->normalizedFilter($filters, 'transactionType');
        $search = mb_strtolower($this->text($filters['search'] ?? ''));
        $currencySections = $this->initializeCurrencySections([
            'initialCapital',
            'rangeContribution',
            'rangeDistribution',
            'rangeNet',
        ]);

        $shareholders = Shareholder::query()
            ->with(['transactions' => static function ($query): void {
                $query
                    ->select(['id', 'shareholder_id', 'transaction_type', 'amount', 'amount_input', 'currency', 'exchange_rate'])
                    ->orderByDesc('transaction_date')
                    ->orderByDesc('id');
            }])
            ->orderBy('full_name')
            ->get()
            ->map(function (Shareholder $shareholder): array {
                $currency = $this->currencyCode($shareholder->currency);
                $exchangeRate = $this->decimal($shareholder->exchange_rate ?? 1) ?: 1.0;
                $initialCapital = $this->decimal($shareholder->initial_capital ?? 0);
                $initialCapitalInput = $this->resolveInputAmount($shareholder->initial_capital_input, $shareholder->initial_capital, $currency, $shareholder->exchange_rate);
                $positionCurrencySections = $this->initializeCurrencySections([
                    'balanceAmount',
                    'contributedAmount',
                    'distributedAmount',
                    'initialCapital',
                ]);
                $this->addCurrencySectionValue($positionCurrencySections, $currency, 'initialCapital', $initialCapitalInput);
                $this->addCurrencySectionValue($positionCurrencySections, $currency, 'balanceAmount', $initialCapitalInput);

                $contributedAmount = 0.0;
                $distributedAmount = 0.0;
                $balanceAmount = $initialCapital;

                foreach ($shareholder->transactions as $transaction) {
                    $transactionCurrency = $this->currencyCode($transaction->currency);
                    $transactionAmount = $this->decimal($transaction->amount ?? 0);
                    $transactionAmountInput = $this->resolveInputAmount($transaction->amount_input, $transaction->amount, $transactionCurrency, $transaction->exchange_rate);

                    if ($this->text($transaction->transaction_type, 'contribution') === 'distribution') {
                        $distributedAmount += $transactionAmount;
                        $balanceAmount -= $transactionAmount;
                        $this->addCurrencySectionValue($positionCurrencySections, $transactionCurrency, 'distributedAmount', $transactionAmountInput);
                        $this->addCurrencySectionValue($positionCurrencySections, $transactionCurrency, 'balanceAmount', -$transactionAmountInput);
                    } else {
                        $contributedAmount += $transactionAmount;
                        $balanceAmount += $transactionAmount;
                        $this->addCurrencySectionValue($positionCurrencySections, $transactionCurrency, 'contributedAmount', $transactionAmountInput);
                        $this->addCurrencySectionValue($positionCurrencySections, $transactionCurrency, 'balanceAmount', $transactionAmountInput);
                    }
                }

                return [
                    'balanceAmount' => $this->decimal($balanceAmount),
                    'contributedAmount' => $this->decimal($contributedAmount),
                    'currency' => $currency,
                    'currencySections' => $positionCurrencySections,
                    'distributedAmount' => $this->decimal($distributedAmount),
                    'exchangeRate' => $exchangeRate,
                    'fullName' => $this->text($shareholder->full_name, "Shareholder #{$shareholder->id}"),
                    'id' => (int) $shareholder->id,
                    'initialCapital' => $initialCapital,
                    'initialCapitalInput' => $initialCapitalInput,
                    'ownershipPercentage' => $this->decimal($shareholder->ownership_percentage ?? 0),
                    'status' => $this->text($shareholder->status, 'active'),
                ];
            })
            ->values()
            ->all();

        $transactions = ShareholderTransaction::query()
            ->with('shareholder:id,full_name')
            ->where('transaction_date', '>=', $startDate->toDateString())
            ->where('transaction_date', '<=', $endDate->toDateString())
            ->orderByDesc('transaction_date')
            ->get()
            ->map(function (ShareholderTransaction $transaction): array {
                $currency = $this->currencyCode($transaction->currency);

                return [
                    'amount' => $this->decimal($transaction->amount ?? 0),
                    'amountInput' => $this->resolveInputAmount($transaction->amount_input, $transaction->amount, $currency, $transaction->exchange_rate),
                    'createdAt' => $this->dateTimeString($transaction->created_at),
                    'currency' => $currency,
                    'exchangeRate' => $this->decimal($transaction->exchange_rate ?? 1) ?: 1.0,
                    'id' => (int) $transaction->id,
                    'notes' => $this->text($transaction->notes),
                    'shareholderId' => (int) ($transaction->shareholder_id ?? 0),
                    'shareholderName' => $this->text($transaction->shareholder?->full_name, $transaction->shareholder_id ? "Shareholder #{$transaction->shareholder_id}" : ''),
                    'transactionDate' => $this->dateString($transaction->transaction_date),
                    'transactionType' => $this->text($transaction->transaction_type, 'contribution'),
                ];
            })
            ->filter(function (array $row) use ($search, $shareholderId, $transactionType): bool {
                if ($shareholderId > 0 && (int) $row['shareholderId'] !== $shareholderId) {
                    return false;
                }
                if ($transactionType !== '' && $row['transactionType'] !== $transactionType) {
                    return false;
                }
                if ($search !== '') {
                    $haystack = mb_strtolower(implode(' ', [$row['shareholderName'], $row['notes'], $row['transactionType']]));
                    if (!str_contains($haystack, $search)) {
                        return false;
                    }
                }

                return true;
            })
            ->values()
            ->all();

        $contribution = 0.0;
        $distribution = 0.0;
        foreach ($shareholders as $shareholder) {
            $this->addCurrencySectionValue($currencySections, $shareholder['currency'] ?? 'AFN', 'initialCapital', $shareholder['initialCapitalInput'] ?? 0);
        }
        foreach ($transactions as $transaction) {
            if ($transaction['transactionType'] === 'distribution') {
                $distribution += (float) ($transaction['amount'] ?? 0);
                $this->addCurrencySectionValue($currencySections, $transaction['currency'] ?? 'AFN', 'rangeDistribution', $transaction['amountInput'] ?? 0);
            } else {
                $contribution += (float) ($transaction['amount'] ?? 0);
                $this->addCurrencySectionValue($currencySections, $transaction['currency'] ?? 'AFN', 'rangeContribution', $transaction['amountInput'] ?? 0);
            }
        }
        foreach (['AFN', 'USD'] as $currency) {
            $currencySections[$currency]['rangeNet'] = $this->decimal(
                ($currencySections[$currency]['rangeContribution'] ?? 0) - ($currencySections[$currency]['rangeDistribution'] ?? 0)
            );
        }

        return [
            'summary' => [
                'activeCount' => count(array_filter($shareholders, static fn (array $row): bool => $row['status'] === 'active')),
                'currencySections' => $currencySections,
                'initialCapital' => $this->decimal(array_sum(array_column($shareholders, 'initialCapital'))),
                'rangeContribution' => $this->decimal($contribution),
                'rangeDistribution' => $this->decimal($distribution),
                'rangeNet' => $this->decimal($contribution - $distribution),
                'totalShareholders' => count($shareholders),
            ],
            'positions' => $shareholders,
            'ledger' => $this->paginateRows(
                $this->sortRows($transactions, (string) ($filters['sortBy'] ?? 'transactionDate'), (string) ($filters['sortDirection'] ?? 'desc')),
                (int) ($filters['page'] ?? 1),
                (int) ($filters['perPage'] ?? 10),
            ),
        ];
    }

    private function agingBucket(int $agingDays): string
    {
        if ($agingDays <= 30) {
            return '0-30 days';
        }
        if ($agingDays <= 60) {
            return '31-60 days';
        }
        if ($agingDays <= 90) {
            return '61-90 days';
        }

        return '90+ days';
    }
}
