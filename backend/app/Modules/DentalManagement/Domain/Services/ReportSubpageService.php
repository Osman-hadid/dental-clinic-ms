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

        $rows = Expense::query()
            ->with('staff:id,full_name')
            ->where('expense_type', 'daily')
            ->where('expense_date', '>=', $startDate->toDateString())
            ->where('expense_date', '<=', $endDate->toDateString())
            ->orderByDesc('expense_date')
            ->orderByDesc('id')
            ->get()
            ->map(function (Expense $expense): array {
                return [
                    'amount' => $this->decimal($expense->amount ?? 0),
                    'amountInput' => $this->decimal($expense->amount_input ?? $expense->amount ?? 0),
                    'category' => $this->text($expense->category, 'Other'),
                    'createdAt' => $this->dateTimeString($expense->created_at),
                    'expenseDate' => $this->dateString($expense->expense_date),
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

        $summary = [
            'allTotal' => $this->decimal(array_sum(array_column($rows, 'amountInput'))),
            'monthTotal' => $this->decimal(array_sum(array_map(
                static fn (array $row): float => str_starts_with((string) $row['expenseDate'], $monthToken) ? (float) $row['amountInput'] : 0.0,
                $rows
            ))),
            'todayTotal' => $this->decimal(array_sum(array_map(
                static fn (array $row): float => $row['expenseDate'] === $today ? (float) $row['amountInput'] : 0.0,
                $rows
            ))),
        ];

        $grouped = [];
        foreach ($rows as $row) {
            $date = (string) $row['expenseDate'];
            $grouped[$date] = $this->decimal(($grouped[$date] ?? 0) + (float) $row['amountInput']);
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

        $rows = Expense::query()
            ->with('staff:id,full_name')
            ->where('expense_type', 'clinical')
            ->where('expense_date', '>=', $startDate->toDateString())
            ->where('expense_date', '<=', $endDate->toDateString())
            ->orderByDesc('expense_date')
            ->orderByDesc('id')
            ->get()
            ->map(function (Expense $expense): array {
                return [
                    'amountInput' => $this->decimal($expense->amount_input ?? $expense->amount ?? 0),
                    'category' => $this->text($expense->category, 'Other'),
                    'createdAt' => $this->dateTimeString($expense->created_at),
                    'expenseDate' => $this->dateString($expense->expense_date),
                    'id' => (int) $expense->id,
                    'itemName' => $this->text($expense->title),
                    'notes' => $this->text($expense->notes),
                    'quantity' => (int) ($expense->quantity ?? 1),
                    'staffId' => (int) ($expense->staff_id ?? 0),
                    'staffName' => $this->text($expense->staff?->full_name, $expense->staff_id ? "Staff #{$expense->staff_id}" : ''),
                    'unitCost' => $this->decimal($expense->unit_cost_input ?? $expense->unit_cost ?? $expense->amount_input ?? $expense->amount ?? 0),
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
        foreach ($rows as $row) {
            $category = (string) $row['category'];
            $byCategory[$category] ??= ['category' => $category, 'amount' => 0.0];
            $byCategory[$category]['amount'] = $this->decimal($byCategory[$category]['amount'] + (float) $row['amountInput']);
        }

        return [
            'summary' => [
                'recordCount' => count($rows),
                'totalSpend' => $this->decimal(array_sum(array_column($rows, 'amountInput'))),
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

        $rows = Debt::query()
            ->with('patient:id,patient_code,first_name,last_name')
            ->where('status', 'open')
            ->where('invoice_date', '>=', $startDate->toDateString())
            ->where('invoice_date', '<=', $endDate->toDateString())
            ->orderByDesc('invoice_date')
            ->get()
            ->map(function (Debt $debt): array {
                $invoiceDate = $this->dateString($debt->invoice_date);
                $agingDays = (int) round($this->parseDate($invoiceDate)?->diffInDays(CarbonImmutable::now()) ?? 0);

                return [
                    'agingBucket' => $this->agingBucket($agingDays),
                    'debtAmount' => $this->decimal($debt->debt_amount ?? 0),
                    'id' => (int) $debt->id,
                    'invoiceDate' => $invoiceDate,
                    'invoiceId' => (string) ($debt->invoice_id ?? ''),
                    'netAmount' => $this->decimal($debt->net_amount ?? 0),
                    'paidAmount' => $this->decimal($debt->paid_amount ?? 0),
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

        $agingBreakdown = [];
        foreach ($rows as $row) {
            $bucket = (string) $row['agingBucket'];
            $agingBreakdown[$bucket] ??= ['amount' => 0.0, 'bucket' => $bucket, 'count' => 0];
            $agingBreakdown[$bucket]['amount'] = $this->decimal($agingBreakdown[$bucket]['amount'] + (float) $row['debtAmount']);
            $agingBreakdown[$bucket]['count'] += 1;
        }

        return [
            'summary' => [
                'debtCount' => count($rows),
                'totalDebt' => $this->decimal(array_sum(array_column($rows, 'debtAmount'))),
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

        $rows = SafeTransaction::query()
            ->with('pickedByStaff:id,full_name')
            ->where('transaction_date', '>=', $startDate->toDateString())
            ->where('transaction_date', '<=', $endDate->toDateString())
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->get()
            ->map(function (SafeTransaction $row): array {
                return [
                    'amountInput' => $this->decimal($row->amount_input ?? $row->amount ?? 0),
                    'createdAt' => $this->dateTimeString($row->created_at),
                    'direction' => $this->text($row->direction, 'in'),
                    'entryType' => $this->text($row->entry_type, 'adjustment'),
                    'id' => (int) $row->id,
                    'notes' => $this->text($row->notes),
                    'pickedByStaffId' => (int) ($row->picked_by_staff_id ?? 0),
                    'pickedByStaffName' => $this->text($row->pickedByStaff?->full_name, $row->picked_by_staff_id ? "Staff #{$row->picked_by_staff_id}" : ''),
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
                $totalOut += (float) $row['amountInput'];
            } else {
                $totalIn += (float) $row['amountInput'];
            }
        }

        return [
            'summary' => [
                'balance' => $this->decimal(SafeTransaction::query()->where('direction', 'in')->sum('amount_input') - SafeTransaction::query()->where('direction', 'out')->sum('amount_input')),
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

        $rows = SalaryPayment::query()
            ->with('staff:id,full_name')
            ->where('payment_date', '>=', $startDate->toDateString())
            ->where('payment_date', '<=', $endDate->toDateString())
            ->orderByDesc('payment_date')
            ->get()
            ->map(function (SalaryPayment $payment): array {
                return [
                    'createdAt' => $this->dateTimeString($payment->created_at),
                    'id' => (int) $payment->id,
                    'netAmountInput' => $this->decimal($payment->net_amount_input ?? $payment->net_amount ?? 0),
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
                $paidTotal += (float) $row['netAmountInput'];
            }
            if ((string) $row['status'] === 'pending') {
                $pendingCount++;
            }
        }

        return [
            'summary' => [
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

        $shareholders = Shareholder::query()
            ->withSum(['transactions as total_contribution_amount' => static function ($query): void {
                $query->where('transaction_type', 'contribution');
            }], 'amount_input')
            ->withSum(['transactions as total_distribution_amount' => static function ($query): void {
                $query->where('transaction_type', 'distribution');
            }], 'amount_input')
            ->orderBy('full_name')
            ->get()
            ->map(function (Shareholder $shareholder): array {
                $contributedAmount = $this->decimal($shareholder->total_contribution_amount ?? 0);
                $distributedAmount = $this->decimal($shareholder->total_distribution_amount ?? 0);

                return [
                    'balanceAmount' => $this->decimal($contributedAmount - $distributedAmount),
                    'contributedAmount' => $contributedAmount,
                    'distributedAmount' => $distributedAmount,
                    'fullName' => $this->text($shareholder->full_name, "Shareholder #{$shareholder->id}"),
                    'id' => (int) $shareholder->id,
                    'initialCapitalInput' => $this->decimal($shareholder->initial_capital_input ?? 0),
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
                return [
                    'amountInput' => $this->decimal($transaction->amount_input ?? $transaction->amount ?? 0),
                    'createdAt' => $this->dateTimeString($transaction->created_at),
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
        foreach ($transactions as $transaction) {
            if ($transaction['transactionType'] === 'distribution') {
                $distribution += (float) $transaction['amountInput'];
            } else {
                $contribution += (float) $transaction['amountInput'];
            }
        }

        return [
            'summary' => [
                'activeCount' => count(array_filter($shareholders, static fn (array $row): bool => $row['status'] === 'active')),
                'initialCapital' => $this->decimal(array_sum(array_column($shareholders, 'initialCapitalInput'))),
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
