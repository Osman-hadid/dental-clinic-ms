<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Models\ActivityLog;
use App\Models\User;
use App\Modules\DentalManagement\Domain\Entities\Expense;
use App\Modules\DentalManagement\Domain\Entities\InventoryAdjustment;
use App\Modules\DentalManagement\Domain\Entities\InventoryItem;
use App\Modules\DentalManagement\Domain\Entities\ReportAccessLog;
use App\Modules\DentalManagement\Domain\Entities\ReportSnapshot;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Domain\Entities\Shareholder;
use App\Modules\DentalManagement\Domain\Entities\Staff;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatmentMaterial;
use App\Modules\DentalManagement\Domain\Services\Concerns\InteractsWithReportData;
use Carbon\CarbonImmutable;

final class ReportDashboardService
{
    use InteractsWithReportData;

    public function __construct(
        private readonly ExecutiveReportSummaryService $executiveReportSummaryService,
        private readonly ReportDatasetService $reportDatasetService,
        private readonly FinancialControlService $financialControlService,
        private readonly OperationsHealthService $operationsHealthService,
    ) {}

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function filterOptions(array $filters): array
    {
        $executive = $this->executiveReportSummaryService->build($filters);

        return [
            'dentists' => $executive['filterOptions']['dentists'] ?? [],
            'patients' => $executive['filterOptions']['patients'] ?? [],
            'paymentMethods' => $executive['filterOptions']['paymentMethods'] ?? [],
            'treatments' => $executive['filterOptions']['treatments'] ?? [],
            'staff' => Staff::query()
                ->orderBy('full_name')
                ->get(['id', 'full_name'])
                ->map(fn (Staff $staff): array => [
                    'id' => (int) $staff->id,
                    'name' => $this->text($staff->full_name, "Staff #{$staff->id}"),
                ])
                ->values()
                ->all(),
            'shareholders' => Shareholder::query()
                ->orderBy('full_name')
                ->get(['id', 'full_name'])
                ->map(fn (Shareholder $shareholder): array => [
                    'id' => (int) $shareholder->id,
                    'name' => $this->text($shareholder->full_name, "Shareholder #{$shareholder->id}"),
                ])
                ->values()
                ->all(),
            'dailyExpenseCategories' => Expense::query()
                ->where('expense_type', 'daily')
                ->distinct()
                ->orderBy('category')
                ->pluck('category')
                ->filter()
                ->values()
                ->all(),
            'clinicalExpenseCategories' => Expense::query()
                ->where('expense_type', 'clinical')
                ->distinct()
                ->orderBy('category')
                ->pluck('category')
                ->filter()
                ->values()
                ->all(),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function executive(array $filters): array
    {
        return $this->executiveReportSummaryService->build($filters);
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function financial(array $filters): array
    {
        $dataset = $this->reportDatasetService->buildFinancial($filters);
        [$startDate, $endDate] = $this->resolveDateRange($filters);
        $summaryOnly = filter_var($filters['summaryOnly'] ?? false, FILTER_VALIDATE_BOOL);
        $granularity = $this->text($filters['granularity'] ?? 'day', 'day');
        $patientNameMap = (array) ($dataset['patientNameMap'] ?? []);
        $visitsById = [];

        foreach (($dataset['visits'] ?? []) as $visit) {
            $visitId = (string) ($visit['id'] ?? '');
            if ($visitId === '') {
                continue;
            }

            $visitsById[$visitId] = $visit;
        }

        $billed = 0.0;
        $net = 0.0;
        $paid = 0.0;
        $outstandingRows = [];
        $outstandingTotal = 0.0;
        $revenueTrend = [];
        $paymentMethodMix = [];
        $revenueByPatient = [];
        $revenueByDentist = [];
        $revenueByTreatment = [];
        $revenueByPaymentMethod = [];
        $currencySections = $this->initializeCurrencySections([
            'billed',
            'expenses',
            'net',
            'outstanding',
            'paid',
            'safeBalance',
            'safeIn',
            'safeOut',
            'salaryPaid',
            'shareholderContribution',
            'shareholderDistribution',
            'thirdCompanyPaid',
            'thirdCompanyUnpaid',
        ]);

        foreach (($dataset['invoiceRows'] ?? []) as $invoice) {
            $invoiceId = (string) ($invoice['id'] ?? '');
            $patientId = (string) ($invoice['patientId'] ?? '');
            $visitId = (string) ($invoice['visitId'] ?? '');
            $invoiceDate = $this->text($invoice['invoiceDate'] ?? '');
            $invoiceCurrency = $this->currencyCode($invoice['currency'] ?? 'AFN');
            $invoiceExchangeRate = $this->decimal($invoice['exchangeRate'] ?? 1) ?: 1.0;
            $billedAmount = $this->decimal($invoice['totalAmount'] ?? 0);
            $netAmount = $this->decimal($invoice['netAmount'] ?? 0);
            $billedAmountInput = $this->resolveInputAmount($invoice['totalAmountInput'] ?? null, $invoice['totalAmount'] ?? 0, $invoiceCurrency, $invoiceExchangeRate);
            $netAmountInput = $this->resolveInputAmount($invoice['netAmountInput'] ?? null, $invoice['netAmount'] ?? 0, $invoiceCurrency, $invoiceExchangeRate);
            $billed += $billedAmount;
            $net += $netAmount;
            $this->addCurrencySectionValue($currencySections, $invoiceCurrency, 'billed', $billedAmountInput);
            $this->addCurrencySectionValue($currencySections, $invoiceCurrency, 'net', $netAmountInput);

            $invoicePaid = 0.0;
            foreach (($invoice['payments'] ?? []) as $payment) {
                $amount = $this->decimal($payment['amount'] ?? 0);
                $paymentCurrency = $this->currencyCode($payment['currency'] ?? 'AFN');
                $paymentExchangeRate = $this->decimal($payment['exchangeRate'] ?? 1) ?: 1.0;
                $amountInput = $this->resolveInputAmount($payment['amountInput'] ?? null, $payment['amount'] ?? 0, $paymentCurrency, $paymentExchangeRate);
                $invoicePaid += $amount;
                $paid += $amount;
                $this->addCurrencySectionValue($currencySections, $paymentCurrency, 'paid', $amountInput);

                $method = $this->text($payment['method'] ?? 'cash', 'cash');
                $bucketDate = $this->parseDate($payment['paymentDate'] ?? $invoiceDate);
                if ($bucketDate !== null) {
                    $bucket = $this->granularityBucket($bucketDate, $granularity);
                    $revenueTrend[$bucket['key']] ??= [
                        'amount' => 0.0,
                        'key' => $bucket['key'],
                        'label' => $bucket['label'],
                        'sort' => $bucket['sort'],
                    ];
                    $revenueTrend[$bucket['key']]['amount'] = $this->decimal($revenueTrend[$bucket['key']]['amount'] + $amount);
                }

                $paymentMethodMix[$method] ??= ['amount' => 0.0, 'count' => 0, 'method' => $method];
                $paymentMethodMix[$method]['amount'] = $this->decimal($paymentMethodMix[$method]['amount'] + $amount);
                $paymentMethodMix[$method]['count'] += 1;
                $revenueByPaymentMethod[$method] ??= ['amount' => 0.0, 'method' => $method];
                $revenueByPaymentMethod[$method]['amount'] = $this->decimal($revenueByPaymentMethod[$method]['amount'] + $amount);
            }

            $invoiceStatus = $this->text($invoice['status'] ?? 'unpaid', 'unpaid');
            $normalizedStatus = mb_strtolower($invoiceStatus);
            $isDebtInvoice = \in_array($normalizedStatus, ['unpaid', 'partially_paid'], true);
            $debt = $isDebtInvoice ? max(0, $netAmount - $invoicePaid) : 0;
            if ($debt > 0) {
                $debtInput = $this->convertBaseAmountToInputCurrency($debt, $invoiceCurrency, $invoiceExchangeRate);
                $outstandingRows[] = [
                    'currency' => $invoiceCurrency,
                    'debtAmount' => $this->decimal($debt),
                    'debtAmountInput' => $debtInput,
                    'exchangeRate' => $invoiceExchangeRate,
                    'invoiceDate' => $invoiceDate,
                    'invoiceId' => $invoiceId,
                    'netAmount' => $netAmount,
                    'netAmountInput' => $netAmountInput,
                    'paidAmount' => $this->decimal($invoicePaid),
                    'patientId' => $patientId,
                    'patientName' => $patientNameMap[$patientId] ?? $this->patientName(null, $patientId),
                    'status' => $invoiceStatus,
                ];
                $outstandingTotal += $debt;
                $this->addCurrencySectionValue($currencySections, $invoiceCurrency, 'outstanding', $debtInput);
            }

            $patientName = $patientNameMap[$patientId] ?? $this->patientName(null, $patientId);
            $revenueByPatient[$patientId] ??= ['amount' => 0.0, 'patientId' => $patientId, 'patientName' => $patientName];
            $revenueByPatient[$patientId]['amount'] = $this->decimal($revenueByPatient[$patientId]['amount'] + $netAmount);

            $dentistName = $this->text($visitsById[$visitId]['dentistName'] ?? '', 'Unknown Dentist');
            $revenueByDentist[$dentistName] ??= ['amount' => 0.0, 'dentist' => $dentistName];
            $revenueByDentist[$dentistName]['amount'] = $this->decimal($revenueByDentist[$dentistName]['amount'] + $netAmount);
        }

        foreach (($dataset['visitTreatmentRows'] ?? []) as $visitTreatment) {
            $treatmentName = $this->text($visitTreatment['treatment']['name'] ?? '', 'Unknown Treatment');
            $price = $this->decimal($visitTreatment['price'] ?? 0);
            $revenueByTreatment[$treatmentName] ??= ['amount' => 0.0, 'name' => $treatmentName, 'sessions' => 0];
            $revenueByTreatment[$treatmentName]['amount'] = $this->decimal($revenueByTreatment[$treatmentName]['amount'] + $price);
            $revenueByTreatment[$treatmentName]['sessions'] += 1;
        }

        $expenseTotal = 0.0;
        $expenseByCategory = [];
        foreach (($dataset['expenseRows'] ?? []) as $expense) {
            $amount = $this->decimal($expense['amount'] ?? 0);
            $currency = $this->currencyCode($expense['currency'] ?? 'AFN');
            $amountInput = $this->resolveInputAmount($expense['amountInput'] ?? null, $expense['amount'] ?? 0, $currency, $expense['exchangeRate'] ?? 1);
            $category = $this->text($expense['category'] ?? 'Other', 'Other');
            $expenseTotal += $amount;
            $expenseByCategory[$category] ??= ['amount' => 0.0, 'category' => $category];
            $expenseByCategory[$category]['amount'] = $this->decimal($expenseByCategory[$category]['amount'] + $amount);
            $this->addCurrencySectionValue($currencySections, $currency, 'expenses', $amountInput);
        }

        $safeIn = 0.0;
        $safeOut = 0.0;
        $safeBalance = 0.0;
        $safeFlow = [];
        $safeLedger = [];
        foreach (($dataset['safeRows'] ?? []) as $row) {
            $amount = $this->decimal($row['amount'] ?? 0);
            $currency = $this->currencyCode($row['currency'] ?? 'AFN');
            $amountInput = $this->resolveInputAmount($row['amountInput'] ?? null, $row['amount'] ?? 0, $currency, $row['exchangeRate'] ?? 1);
            $direction = $this->text($row['direction'] ?? 'in', 'in');
            $transactionDate = $this->text($row['transactionDate'] ?? '');
            if ($direction === 'out') {
                $safeOut += $amount;
                $this->addCurrencySectionValue($currencySections, $currency, 'safeOut', $amountInput);
            } else {
                $safeIn += $amount;
                $this->addCurrencySectionValue($currencySections, $currency, 'safeIn', $amountInput);
            }

            $bucketDate = $this->parseDate($transactionDate);
            if ($bucketDate !== null) {
                $bucket = $this->granularityBucket($bucketDate, $granularity);
                $safeFlow[$bucket['key']] ??= [
                    'in' => 0.0,
                    'key' => $bucket['key'],
                    'label' => $bucket['label'],
                    'out' => 0.0,
                    'sort' => $bucket['sort'],
                ];
                $safeFlow[$bucket['key']][$direction === 'out' ? 'out' : 'in'] = $this->decimal(
                    $safeFlow[$bucket['key']][$direction === 'out' ? 'out' : 'in'] + $amount
                );
            }

            $safeLedger[] = [
                'amount' => $amount,
                'amountInput' => $amountInput,
                'currency' => $currency,
                'direction' => $direction,
                'entryType' => $this->text($row['entryType'] ?? '', 'adjustment'),
                'exchangeRate' => $this->decimal($row['exchangeRate'] ?? 1) ?: 1.0,
                'notes' => $this->text($row['notes'] ?? ''),
                'pickedByStaffName' => $this->text($row['pickedByStaffName'] ?? ''),
                'transactionDate' => $transactionDate,
            ];
        }

        $safeBalanceRows = SafeTransaction::query()
            ->select(['direction', 'amount', 'amount_input', 'currency', 'exchange_rate'])
            ->where('transaction_date', '<=', $endDate->toDateString())
            ->get();

        foreach ($safeBalanceRows as $balanceRow) {
            $amount = $this->decimal($balanceRow->amount ?? 0);
            $currency = $this->currencyCode($balanceRow->currency);
            $amountInput = $this->resolveInputAmount($balanceRow->amount_input, $balanceRow->amount, $currency, $balanceRow->exchange_rate);
            if (($balanceRow->direction ?? 'in') === 'out') {
                $safeBalance -= $amount;
                $this->addCurrencySectionValue($currencySections, $currency, 'safeBalance', -$amountInput);
            } else {
                $safeBalance += $amount;
                $this->addCurrencySectionValue($currencySections, $currency, 'safeBalance', $amountInput);
            }
        }

        $salaryPaid = 0.0;
        foreach (($dataset['salaryRows'] ?? []) as $salary) {
            if (in_array((string) ($salary['status'] ?? ''), ['paid', 'partial'], true)) {
                $salaryPaid += $this->decimal($salary['netAmount'] ?? 0);
                $this->addCurrencySectionValue(
                    $currencySections,
                    $salary['currency'] ?? 'AFN',
                    'salaryPaid',
                    $this->resolveInputAmount($salary['netAmountInput'] ?? null, $salary['netAmount'] ?? 0, $salary['currency'] ?? 'AFN', $salary['exchangeRate'] ?? 1)
                );
            }
        }

        $shareholderContribution = 0.0;
        $shareholderDistribution = 0.0;
        $shareholderLedger = [];
        foreach (($dataset['shareholderTransactionRows'] ?? []) as $transaction) {
            $amount = $this->decimal($transaction['amount'] ?? 0);
            $currency = $this->currencyCode($transaction['currency'] ?? 'AFN');
            $amountInput = $this->resolveInputAmount($transaction['amountInput'] ?? null, $transaction['amount'] ?? 0, $currency, $transaction['exchangeRate'] ?? 1);
            $type = $this->text($transaction['transactionType'] ?? 'contribution', 'contribution');
            if ($type === 'distribution') {
                $shareholderDistribution += $amount;
                $this->addCurrencySectionValue($currencySections, $currency, 'shareholderDistribution', $amountInput);
            } else {
                $shareholderContribution += $amount;
                $this->addCurrencySectionValue($currencySections, $currency, 'shareholderContribution', $amountInput);
            }

            $shareholderLedger[] = [
                'amount' => $amount,
                'amountInput' => $amountInput,
                'currency' => $currency,
                'exchangeRate' => $this->decimal($transaction['exchangeRate'] ?? 1) ?: 1.0,
                'notes' => $this->text($transaction['notes'] ?? ''),
                'shareholderId' => (string) ($transaction['shareholderId'] ?? ''),
                'shareholderName' => $this->text($transaction['shareholderName'] ?? '', 'Unknown Shareholder'),
                'transactionDate' => $this->text($transaction['transactionDate'] ?? ''),
                'transactionType' => $type,
            ];
        }

        $patientFilter = $this->normalizedFilter($filters, 'patientFilter');
        $statusFilter = $this->normalizedFilter($filters, 'statusFilter');
        $implantCompanyMap = [];
        foreach (($dataset['implantCompanies'] ?? []) as $company) {
            $companyId = (string) ($company['id'] ?? '');
            if ($companyId === '') {
                continue;
            }

            $implantCompanyMap[$companyId] = [
                'companyName' => $this->text($company['companyName'] ?? '', "Company #{$companyId}"),
                'implantType' => $this->text($company['implantType'] ?? '', '-'),
                'note' => $this->text($company['note'] ?? ''),
                'recordDate' => $this->text($company['recordDate'] ?? ''),
            ];
        }
        $implantInstallments = [];
        foreach (($dataset['patientSessionTasks'] ?? []) as $task) {
            $notes = $this->text($task['notes'] ?? '');
            $title = $this->text($task['title'] ?? '');
            if (!$this->isImplantTask($title, $notes)) {
                continue;
            }

            $patientId = (string) ($task['patientId'] ?? '');
            if ($patientFilter !== '' && $patientId !== $patientFilter) {
                continue;
            }

            $availability = $this->taskAvailability($notes, $this->text($task['status'] ?? 'pending'));
            $reportStatus = $availability === 'done' ? 'completed' : 'pending';
            if ($statusFilter !== '' && $reportStatus !== $statusFilter) {
                continue;
            }

            $supplierTotal = $this->taggedAmount($notes, 'supplier_total');
            $supplierPaid = min($supplierTotal, $this->taggedAmount($notes, 'supplier_paid'));
            $supplierCurrency = $this->currencyCode($this->taggedText($notes, 'currency'));
            $supplierExchangeRate = $this->decimal($this->taggedText($notes, 'exchangeRate')) ?: 1.0;
            $supplierTotalInput = $this->taggedInputAmount($notes, 'supplier_total_input', 'supplier_total', $supplierCurrency, $supplierExchangeRate);
            $supplierPaidInput = min(
                $supplierTotalInput,
                $this->taggedInputAmount($notes, 'supplier_paid_input', 'supplier_paid', $supplierCurrency, $supplierExchangeRate)
            );
            $implantInstallments[] = [
                'availability' => $availability,
                'createdAt' => $this->dateTimeString($task['createdAt'] ?? ''),
                'currency' => $supplierCurrency,
                'exchangeRate' => $supplierExchangeRate,
                'implantCompanyId' => (string) ($task['implantCompanyId'] ?? ''),
                'patientId' => $patientId,
                'patientName' => $patientNameMap[$patientId] ?? $this->patientName(null, $patientId),
                'supplierPaid' => $this->decimal($supplierPaid),
                'supplierPaidInput' => $this->decimal($supplierPaidInput),
                'supplierRemaining' => $this->decimal(max(0, $supplierTotal - $supplierPaid)),
                'supplierRemainingInput' => $this->decimal(max(0, $supplierTotalInput - $supplierPaidInput)),
                'supplierTotal' => $this->decimal($supplierTotal),
                'supplierTotalInput' => $this->decimal($supplierTotalInput),
                'toothNumber' => $this->implantToothNumber($notes, $title) ?? '-',
            ];
        }

        $rowsByToothKey = [];
        foreach ($implantInstallments as $row) {
            $key = (string) ($row['patientId'] ?? '').':'.(string) ($row['toothNumber'] ?? '');
            if ($key === ':' || $key === '') {
                continue;
            }

            $previous = $rowsByToothKey[$key] ?? null;
            if ($previous === null) {
                $rowsByToothKey[$key] = $row;
                continue;
            }

            $currentDate = $this->parseDate($row['createdAt'] ?? '');
            $previousDate = $this->parseDate($previous['createdAt'] ?? '');
            if ($previousDate === null || ($currentDate !== null && $currentDate->gt($previousDate))) {
                $rowsByToothKey[$key] = $row;
            }
        }
        $thirdCompanyPaid = $this->decimal(array_sum(array_map(
            static fn (array $row): float => (float) ($row['supplierPaid'] ?? 0),
            array_values($rowsByToothKey)
        )));
        $thirdCompanyUnpaid = $this->decimal(array_sum(array_map(
            static fn (array $row): float => (float) ($row['supplierRemaining'] ?? 0),
            array_values($rowsByToothKey)
        )));
        foreach ($rowsByToothKey as $row) {
            $this->addCurrencySectionValue($currencySections, $row['currency'] ?? 'AFN', 'thirdCompanyPaid', $row['supplierPaidInput'] ?? 0);
            $this->addCurrencySectionValue($currencySections, $row['currency'] ?? 'AFN', 'thirdCompanyUnpaid', $row['supplierRemainingInput'] ?? 0);
        }

        $implantCompanyRecords = [];
        foreach ($rowsByToothKey as $row) {
            $companyId = (string) ($row['implantCompanyId'] ?? '');
            if ($companyId === '') {
                continue;
            }

            $details = $implantCompanyMap[$companyId] ?? [
                'companyName' => "Company #{$companyId}",
                'implantType' => '-',
                'note' => '',
                'recordDate' => '',
            ];

            if (!isset($implantCompanyRecords[$companyId])) {
                $implantCompanyRecords[$companyId] = [
                    'companyId' => $companyId,
                    'companyName' => $details['companyName'],
                    'implantType' => $details['implantType'],
                    'recordDate' => $details['recordDate'],
                    'note' => $details['note'],
                    'implantCount' => 0,
                    'supplierPaid' => 0.0,
                    'supplierRemaining' => 0.0,
                    'supplierTotal' => 0.0,
                ];
            }

            $implantCompanyRecords[$companyId]['implantCount'] += 1;
            $implantCompanyRecords[$companyId]['supplierPaid'] = $this->decimal(
                $implantCompanyRecords[$companyId]['supplierPaid'] + (float) ($row['supplierPaid'] ?? 0)
            );
            $implantCompanyRecords[$companyId]['supplierRemaining'] = $this->decimal(
                $implantCompanyRecords[$companyId]['supplierRemaining'] + (float) ($row['supplierRemaining'] ?? 0)
            );
            $implantCompanyRecords[$companyId]['supplierTotal'] = $this->decimal(
                $implantCompanyRecords[$companyId]['supplierTotal'] + (float) ($row['supplierTotal'] ?? 0)
            );
        }

        $collectionRate = $net > 0 ? round(min(100, ($paid / $net) * 100), 1) : 0.0;
        $revenueTrendRows = array_values($revenueTrend);
        usort($revenueTrendRows, static fn (array $left, array $right): int => $left['sort'] <=> $right['sort']);
        $safeFlowRows = array_values($safeFlow);
        usort($safeFlowRows, static fn (array $left, array $right): int => $left['sort'] <=> $right['sort']);
        $financialControlInsights = $this->financialControlService->buildRangeInsights($startDate, $endDate);
        $financialControlSummary = (array) ($financialControlInsights['summary'] ?? []);
        $financialControlTables = (array) ($financialControlInsights['tables'] ?? []);

        $payload = [
            'summary' => [
                'billed' => $this->decimal($billed),
                'closeCount' => (int) ($financialControlSummary['closeCount'] ?? 0),
                'collectionRate' => $collectionRate,
                'currencySections' => $currencySections,
                'discrepancyTotal' => $this->decimal($financialControlSummary['discrepancyTotal'] ?? 0),
                'expenses' => $this->decimal($expenseTotal),
                'latestCloseDifference' => $this->decimal($financialControlSummary['latestCloseDifference'] ?? 0),
                'net' => $this->decimal($net),
                'openDebtCount' => (int) ($financialControlSummary['openDebtCount'] ?? count($outstandingRows)),
                'outstanding' => $this->decimal($outstandingTotal),
                'overdueDebtCount' => (int) ($financialControlSummary['overdueDebtCount'] ?? 0),
                'paid' => $this->decimal($paid),
                'safeBalance' => $this->decimal(max(0, $safeBalance)),
                'safeIn' => $this->decimal($safeIn),
                'safeOut' => $this->decimal($safeOut),
                'salaryPaid' => $this->decimal($salaryPaid),
                'shareholderContribution' => $this->decimal($shareholderContribution),
                'shareholderDistribution' => $this->decimal($shareholderDistribution),
                'thirdCompanyPaid' => $thirdCompanyPaid,
                'thirdCompanyUnpaid' => $thirdCompanyUnpaid,
            ],
        ];

        if ($summaryOnly) {
            return $payload;
        }

        return $payload + [
            'charts' => [
                'expenseByCategory' => array_slice($this->sortRows(array_values($expenseByCategory), 'amount'), 0, 12),
                'paymentMethodMix' => array_slice($this->sortRows(array_values($paymentMethodMix), 'amount'), 0, 12),
                'revenueTrend' => array_map(static fn (array $row): array => [
                    'amount' => $row['amount'],
                    'key' => $row['key'],
                    'label' => $row['label'],
                ], $revenueTrendRows),
                'safeFlow' => array_map(static fn (array $row): array => [
                    'in' => $row['in'],
                    'key' => $row['key'],
                    'label' => $row['label'],
                    'out' => $row['out'],
                ], $safeFlowRows),
            ],
            'tables' => [
                'collectorPerformance' => array_slice((array) ($financialControlTables['collectorPerformance'] ?? []), 0, 12),
                'dailyCloseRows' => array_slice((array) ($financialControlTables['dailyCloseRows'] ?? []), 0, 20),
                'debtWatchlist' => array_slice((array) ($financialControlTables['debtWatchlist'] ?? []), 0, 20),
                'implantCompanyRecords' => array_slice($this->sortRows(array_values($implantCompanyRecords), 'supplierRemaining'), 0, 50),
                'implantInstallments' => array_slice($this->sortRows($implantInstallments, 'createdAt'), 0, 25),
                'outstandingInvoices' => array_slice($this->sortRows($outstandingRows, 'debtAmount'), 0, 25),
                'revenueByDentist' => array_slice($this->sortRows(array_values($revenueByDentist), 'amount'), 0, 25),
                'revenueByPatient' => array_slice($this->sortRows(array_values($revenueByPatient), 'amount'), 0, 25),
                'revenueByPaymentMethod' => array_slice($this->sortRows(array_values($revenueByPaymentMethod), 'amount'), 0, 25),
                'revenueByTreatment' => array_slice($this->sortRows(array_values($revenueByTreatment), 'amount'), 0, 25),
                'safeLedger' => array_slice($this->sortRows($safeLedger, 'transactionDate'), 0, 50),
                'shareholderLedger' => array_slice($this->sortRows($shareholderLedger, 'transactionDate'), 0, 50),
            ],
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function clinical(array $filters): array
    {
        $dataset = $this->reportDatasetService->buildClinical($filters);
        $executive = $this->executiveReportSummaryService->build($filters);
        $patientNameMap = (array) ($dataset['patientNameMap'] ?? []);
        [$reportStartDate, $reportEndDate] = $this->resolveDateRange($filters);

        $appointmentStatusBreakdown = [];
        foreach (($dataset['appointments'] ?? []) as $appointment) {
            $status = $this->reportStatus((string) ($appointment['status'] ?? 'pending'));
            $appointmentStatusBreakdown[$status] ??= ['count' => 0, 'status' => $status];
            $appointmentStatusBreakdown[$status]['count'] += 1;
        }

        $prescriptionRows = [];
        foreach (($dataset['visitTreatments'] ?? []) as $visitTreatment) {
            $prescription = $visitTreatment['prescription'] ?? null;
            if (!is_array($prescription)) {
                continue;
            }

            $visit = (array) ($visitTreatment['visit'] ?? []);
            $visitId = (string) ($visitTreatment['visitId'] ?? '');
            $patientId = (string) ($visit['patientId'] ?? '');
            $prescriptionRows[] = [
                'createdAt' => $this->dateTimeString($prescription['createdAt'] ?? ''),
                'medicineName' => $this->text($prescription['name'] ?? '', 'Custom prescription'),
                'patientId' => $patientId,
                'patientName' => $patientNameMap[$patientId] ?? $this->patientName(null, $patientId),
                'treatmentName' => $this->text($visitTreatment['treatment']['name'] ?? '', 'Unknown Treatment'),
                'visitDate' => $this->text($visit['visitDate'] ?? ''),
                'visitId' => $visitId,
            ];
        }

        $implantCases = [];
        foreach (($dataset['patientSessionTasks'] ?? []) as $task) {
            $notes = $this->text($task['notes'] ?? '');
            $title = $this->text($task['title'] ?? '');
            if (!$this->isImplantTask($title, $notes)) {
                continue;
            }

            $patientId = (string) ($task['patientId'] ?? '');
            $implantCases[] = [
                'availability' => $this->taskAvailability($notes, $this->text($task['status'] ?? 'pending')),
                'patientName' => $patientNameMap[$patientId] ?? $this->patientName(null, $patientId),
                'supplierRemaining' => $this->decimal(
                    max(0, $this->taggedAmount($notes, 'supplier_total') - $this->taggedAmount($notes, 'supplier_paid'))
                ),
                'toothNumber' => $this->implantToothNumber($notes, $title) ?? '-',
                'updatedAt' => $this->dateTimeString($task['updatedAt'] ?? $task['createdAt'] ?? ''),
            ];
        }

        $patientTimelineRows = $this->buildClinicalTimelineRows($dataset, $patientNameMap, $prescriptionRows);
        $queueSnapshotRows = $this->buildClinicalQueueRows($dataset, $patientNameMap, $reportEndDate);
        $treatmentCorrectionRows = $this->buildTreatmentCorrectionRows($reportStartDate, $reportEndDate, $patientNameMap);
        $timelinePatients = [];
        foreach ($patientTimelineRows as $row) {
            $patientId = (string) ($row['patientId'] ?? '');
            if ($patientId !== '') {
                $timelinePatients[$patientId] = true;
            }
        }

        $waitingAppointments = 0;
        $inChairAppointments = 0;
        $lateAppointments = 0;
        foreach ($queueSnapshotRows as $row) {
            $status = $this->text($row['statusKey'] ?? '');
            if (\in_array($status, ['checked_in', 'waiting'], true)) {
                $waitingAppointments += 1;
            }
            if ($status === 'in_chair') {
                $inChairAppointments += 1;
            }
            if ((bool) ($row['late'] ?? false)) {
                $lateAppointments += 1;
            }
        }

        return [
            'summary' => [
                'appointments' => count($dataset['appointments'] ?? []),
                'completedAppointments' => (int) (($appointmentStatusBreakdown['completed']['count'] ?? 0)),
                'implantCases' => count($implantCases),
                'inChairAppointments' => $inChairAppointments,
                'lateAppointments' => $lateAppointments,
                'patients' => count($dataset['patients'] ?? []),
                'prescriptions' => count($prescriptionRows),
                'correctedTreatments' => count($treatmentCorrectionRows),
                'timelineEvents' => count($patientTimelineRows),
                'timelinePatients' => count($timelinePatients),
                'visitTreatments' => count($dataset['visitTreatments'] ?? []),
                'visits' => count($dataset['visits'] ?? []),
                'waitingAppointments' => $waitingAppointments,
            ],
            'charts' => [
                'appointmentStatusBreakdown' => array_values($appointmentStatusBreakdown),
                'dentistProductivity' => $executive['dentistProductivity'] ?? [],
                'implantPlacementTrend' => $executive['implantPlacementTrend'] ?? [],
                'treatmentVolume' => $executive['treatmentVolume'] ?? [],
            ],
            'tables' => [
                'dentistPerformance' => array_slice($executive['dentistProductivity'] ?? [], 0, 25),
                'implantCases' => array_slice($this->sortRows($implantCases, 'updatedAt'), 0, 25),
                'patientTimeline' => array_slice($this->sortRows($patientTimelineRows, 'occurredAt'), 0, 30),
                'prescriptions' => array_slice($this->sortRows($prescriptionRows, 'createdAt'), 0, 25),
                'queueSnapshot' => array_slice($this->sortRows($queueSnapshotRows, 'scheduledAt'), 0, 30),
                'treatmentCorrections' => array_slice($treatmentCorrectionRows, 0, 25),
                'treatmentPerformance' => array_slice($executive['treatmentVolume'] ?? [], 0, 25),
            ],
        ];
    }

    /**
     * @param array<string, mixed> $dataset
     * @param array<string, string> $patientNameMap
     * @param array<int, array<string, mixed>> $prescriptionRows
     * @return array<int, array<string, mixed>>
     */
    private function buildClinicalTimelineRows(array $dataset, array $patientNameMap, array $prescriptionRows): array
    {
        $rows = [];

        foreach (($dataset['appointments'] ?? []) as $appointment) {
            $patientId = (string) ($appointment['patientId'] ?? '');
            $status = $this->humanizeStatus($this->text($appointment['status'] ?? 'scheduled', 'scheduled'));
            $timeRange = trim(implode(' - ', array_filter([
                $this->text($appointment['startTime'] ?? ''),
                $this->text($appointment['endTime'] ?? ''),
            ])));

            $rows[] = [
                'details' => implode(' | ', array_filter([
                    $this->text($appointment['dentistName'] ?? ''),
                    $timeRange,
                ])),
                'eventLabel' => "Appointment {$status}",
                'eventType' => 'appointment',
                'occurredAt' => $this->text($appointment['appointmentDate'] ?? $appointment['createdAt'] ?? ''),
                'patientId' => $patientId,
                'patientName' => $patientNameMap[$patientId] ?? $this->patientName(null, $patientId),
            ];
        }

        foreach (($dataset['visits'] ?? []) as $visit) {
            $patientId = (string) ($visit['patientId'] ?? '');
            $rows[] = [
                'details' => implode(' | ', array_filter([
                    $this->text($visit['tag'] ?? ''),
                    $this->text($visit['dentistName'] ?? ''),
                ])),
                'eventLabel' => 'Visit recorded',
                'eventType' => 'visit',
                'occurredAt' => $this->text($visit['visitDate'] ?? $visit['createdAt'] ?? ''),
                'patientId' => $patientId,
                'patientName' => $patientNameMap[$patientId] ?? $this->patientName(null, $patientId),
            ];
        }

        foreach (($dataset['visitTreatments'] ?? []) as $visitTreatment) {
            $visit = (array) ($visitTreatment['visit'] ?? []);
            $patientId = (string) ($visit['patientId'] ?? '');
            $rows[] = [
                'details' => implode(' | ', array_filter([
                    $this->text($visit['tag'] ?? ''),
                    $this->text($visitTreatment['toothNumber'] ?? ''),
                    $this->text($visit['visitDate'] ?? ''),
                ])),
                'eventLabel' => $this->text($visitTreatment['treatment']['name'] ?? '', 'Treatment recorded'),
                'eventType' => 'treatment',
                'occurredAt' => $this->text($visit['visitDate'] ?? $visitTreatment['createdAt'] ?? ''),
                'patientId' => $patientId,
                'patientName' => $patientNameMap[$patientId] ?? $this->patientName(null, $patientId),
            ];
        }

        foreach ($prescriptionRows as $prescriptionRow) {
            $patientId = (string) ($prescriptionRow['patientId'] ?? '');
            $rows[] = [
                'details' => implode(' | ', array_filter([
                    $this->text($prescriptionRow['medicineName'] ?? ''),
                    $this->text($prescriptionRow['treatmentName'] ?? ''),
                ])),
                'eventLabel' => 'Prescription issued',
                'eventType' => 'prescription',
                'occurredAt' => $this->text($prescriptionRow['visitDate'] ?? $prescriptionRow['createdAt'] ?? ''),
                'patientId' => $patientId,
                'patientName' => $patientNameMap[$patientId] ?? $this->patientName(null, $patientId),
            ];
        }

        foreach (($dataset['invoiceRows'] ?? []) as $invoice) {
            $patientId = (string) ($invoice['patientId'] ?? '');
            $rows[] = [
                'details' => implode(' | ', array_filter([
                    "Invoice #".$this->text($invoice['id'] ?? ''),
                    $this->humanizeStatus($this->text($invoice['status'] ?? 'pending', 'pending')),
                    'Net '.$this->decimal($invoice['netAmount'] ?? 0),
                ])),
                'eventLabel' => 'Invoice generated',
                'eventType' => 'invoice',
                'occurredAt' => $this->text($invoice['invoiceDate'] ?? ''),
                'patientId' => $patientId,
                'patientName' => $patientNameMap[$patientId] ?? $this->patientName(null, $patientId),
            ];

            foreach (($invoice['payments'] ?? []) as $payment) {
                $rows[] = [
                    'details' => implode(' | ', array_filter([
                        "Invoice #".$this->text($invoice['id'] ?? ''),
                        $this->text($payment['method'] ?? ''),
                        'Amount '.$this->decimal($payment['amount'] ?? 0),
                    ])),
                    'eventLabel' => 'Payment received',
                    'eventType' => 'payment',
                    'occurredAt' => $this->text($payment['paymentDate'] ?? $invoice['invoiceDate'] ?? ''),
                    'patientId' => $patientId,
                    'patientName' => $patientNameMap[$patientId] ?? $this->patientName(null, $patientId),
                ];
            }
        }

        foreach (($dataset['patientSessionTasks'] ?? []) as $task) {
            $patientId = (string) ($task['patientId'] ?? '');
            $rows[] = [
                'details' => implode(' | ', array_filter([
                    $this->text($task['title'] ?? ''),
                    $this->humanizeStatus($this->text($task['status'] ?? 'pending', 'pending')),
                ])),
                'eventLabel' => 'Session task updated',
                'eventType' => 'task',
                'occurredAt' => $this->text($task['updatedAt'] ?? $task['createdAt'] ?? ''),
                'patientId' => $patientId,
                'patientName' => $patientNameMap[$patientId] ?? $this->patientName(null, $patientId),
            ];
        }

        return array_values(array_filter($rows, fn (array $row): bool => $this->text($row['occurredAt'] ?? '') !== ''));
    }

    /**
     * @param array<string, mixed> $dataset
     * @param array<string, string> $patientNameMap
     * @return array<int, array<string, mixed>>
     */
    private function buildClinicalQueueRows(array $dataset, array $patientNameMap, CarbonImmutable $referenceDate): array
    {
        $rows = [];

        foreach (($dataset['appointments'] ?? []) as $appointment) {
            $patientId = (string) ($appointment['patientId'] ?? '');
            $statusKey = str_replace(' ', '_', mb_strtolower($this->text($appointment['status'] ?? 'scheduled', 'scheduled')));
            $appointmentDate = $this->text($appointment['appointmentDate'] ?? '');
            $startTime = $this->text($appointment['startTime'] ?? '');
            $endTime = $this->text($appointment['endTime'] ?? '');
            $scheduledAt = $appointmentDate !== ''
                ? $this->parseDate(trim($appointmentDate.' '.($startTime !== '' ? $startTime : '00:00')))
                : null;

            $rows[] = [
                'appointmentTag' => $this->text($appointment['tag'] ?? '', 'Appointment #'.$this->text($appointment['id'] ?? '')),
                'date' => $appointmentDate,
                'dentistName' => $this->text($appointment['dentistName'] ?? '', 'Unknown Dentist'),
                'late' => $scheduledAt !== null
                    && $scheduledAt->lt($referenceDate)
                    && \in_array($statusKey, ['scheduled', 'checked_in', 'waiting'], true),
                'patientId' => $patientId,
                'patientName' => $patientNameMap[$patientId] ?? $this->patientName(null, $patientId),
                'scheduledAt' => $scheduledAt?->format(DATE_ATOM) ?? $appointmentDate,
                'status' => $this->humanizeStatus($statusKey),
                'statusKey' => $statusKey,
                'timeRange' => trim(implode(' - ', array_filter([$startTime, $endTime]))),
            ];
        }

        return $rows;
    }

    private function humanizeStatus(string $value): string
    {
        $normalized = str_replace('_', ' ', mb_strtolower(trim($value)));

        return $normalized !== '' ? ucfirst($normalized) : 'Pending';
    }

    /**
     * @param array<string, string> $patientNameMap
     * @return array<int, array<string, mixed>>
     */
    private function buildTreatmentCorrectionRows(
        CarbonImmutable $reportStartDate,
        CarbonImmutable $reportEndDate,
        array $patientNameMap
    ): array
    {
        $activityRows = ActivityLog::query()
            ->where('subject_type', VisitTreatment::class)
            ->where('event', 'corrected')
            ->where('created_at', '>=', $reportStartDate->startOfDay())
            ->where('created_at', '<=', $reportEndDate->endOfDay())
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        if ($activityRows->isEmpty()) {
            return [];
        }

        $visitTreatmentIds = $activityRows
            ->pluck('subject_id')
            ->filter(static fn ($id): bool => (int) $id > 0)
            ->unique()
            ->values()
            ->all();

        $visitTreatments = VisitTreatment::query()
            ->with(['visit:id,patient_id,visit_date,tag', 'treatment:id,name'])
            ->whereIn('id', $visitTreatmentIds)
            ->get()
            ->keyBy('id');

        $rows = [];
        foreach ($activityRows as $activity) {
            $visitTreatment = $visitTreatments->get((int) ($activity->subject_id ?? 0));
            $properties = is_array($activity->properties) ? $activity->properties : [];
            $patientId = (string) ($visitTreatment?->visit?->patient_id ?? '');
            $diff = is_array($properties['diff'] ?? null) ? $properties['diff'] : [];
            $changeSummary = $diff === []
                ? '-'
                : implode(', ', array_map(
                    static fn (array $change): string => (string) ($change['label'] ?? $change['field'] ?? 'Change'),
                    array_slice($diff, 0, 3)
                ));

            $rows[] = [
                'changedAt' => $this->dateTimeString($activity->created_at),
                'changedBy' => $this->resolveAuditUserLabel((int) ($activity->causer_id ?? 0), $activity->causer_type),
                'changeSummary' => $changeSummary,
                'correctionReason' => $this->text($properties['correctionReason'] ?? ''),
                'patientName' => $patientNameMap[$patientId] ?? $this->patientName(null, $patientId),
                'treatmentName' => $this->text($visitTreatment?->treatment?->name, 'Unknown Treatment'),
                'visitLabel' => $visitTreatment?->visit?->tag
                    ? $this->text($visitTreatment->visit->tag).' | '.$this->text($visitTreatment->visit->visit_date)
                    : $this->text($visitTreatment?->visit?->visit_date, 'Visit #'.(string) ($visitTreatment?->visit_id ?? '-')),
            ];
        }

        return $rows;
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function inventory(array $filters): array
    {
        [$startDate, $endDate] = $this->resolveDateRange($filters);

        $inventoryItems = InventoryItem::query()
            ->withSum('visitTreatmentMaterials as consumed_quantity', 'quantity_used')
            ->orderBy('item_name')
            ->get();

        $usageRows = VisitTreatmentMaterial::query()
            ->with([
                'inventoryItem:id,item_name,category,unit',
                'visitTreatment:id,visit_id,treatment_id',
                'visitTreatment.treatment:id,name',
                'visitTreatment.visit:id,patient_id,visit_date',
                'visitTreatment.visit.patient:id,patient_code,first_name,last_name',
            ])
            ->whereHas('visitTreatment.visit', function ($query) use ($startDate, $endDate): void {
                $query->where('visit_date', '>=', $startDate->toDateString())
                    ->where('visit_date', '<=', $endDate->toDateString());
            })
            ->orderByDesc('created_at')
            ->get();

        $adjustments = InventoryAdjustment::query()
            ->with('inventoryItem:id,item_name,category,unit,supplier,quantity,min_stock,unit_cost')
            ->where('adjustment_date', '>=', $startDate->toDateString())
            ->where('adjustment_date', '<=', $endDate->toDateString())
            ->orderByDesc('adjustment_date')
            ->orderByDesc('created_at')
            ->get();

        $stockRows = [];
        $availabilityBreakdown = [];
        $categoryBreakdown = [];
        $totalQuantity = 0;
        $totalValue = 0.0;
        $stockPressureRows = [];

        foreach ($inventoryItems as $item) {
            $consumedQuantity = max(0, (int) round((float) ($item->consumed_quantity ?? 0)));
            $quantity = (int) ($item->quantity ?? 0);
            $availableQuantity = max(0, $quantity);
            $stockValue = $this->decimal($availableQuantity * (float) ($item->unit_cost ?? 0));
            $availability = $availableQuantity <= 0
                ? 'out_of_stock'
                : ($availableQuantity <= (int) ($item->min_stock ?? 0) ? 'low_stock' : 'in_stock');

            $row = [
                'availableQuantity' => $availableQuantity,
                'availability' => $availability,
                'category' => $this->text($item->category, 'Other'),
                'consumedQuantity' => $consumedQuantity,
                'entryDate' => $this->dateString($item->entry_date),
                'expiryDate' => $this->dateString($item->expiry_date),
                'id' => (int) $item->id,
                'itemName' => $this->text($item->item_name, "Item #{$item->id}"),
                'minStock' => (int) ($item->min_stock ?? 0),
                'quantity' => $quantity,
                'stockValue' => $stockValue,
                'supplier' => $this->text($item->supplier),
                'unit' => $this->text($item->unit, 'unit'),
                'unitCost' => $this->decimal($item->unit_cost ?? 0),
            ];

            $stockRows[] = $row;
            $totalQuantity += $availableQuantity;
            $totalValue += $stockValue;
            $availabilityBreakdown[$availability] ??= ['count' => 0, 'status' => $availability];
            $availabilityBreakdown[$availability]['count'] += 1;
            $category = $row['category'];
            $categoryBreakdown[$category] ??= ['category' => $category, 'count' => 0];
            $categoryBreakdown[$category]['count'] += 1;

            if (\in_array($availability, ['low_stock', 'out_of_stock'], true)) {
                $substitute = InventoryItem::query()
                    ->where('id', '!=', $item->id)
                    ->where('category', $item->category)
                    ->where('quantity', '>', 0)
                    ->orderByDesc('quantity')
                    ->orderBy('item_name')
                    ->first(['item_name', 'quantity']);

                $stockPressureRows[] = [
                    'availableQuantity' => $availableQuantity,
                    'category' => $row['category'],
                    'itemName' => $row['itemName'],
                    'minStock' => $row['minStock'],
                    'recommendedAction' => $availability === 'out_of_stock' ? 'Reorder now' : 'Top up soon',
                    'status' => $availability,
                    'substituteItemName' => $this->text($substitute?->item_name),
                    'substituteQuantity' => (int) ($substitute?->quantity ?? 0),
                    'supplier' => $row['supplier'],
                ];
            }
        }

        $usageTable = [];
        $usageByTreatment = [];
        foreach ($usageRows as $usage) {
            $patient = $usage->visitTreatment?->visit?->patient;
            $treatmentName = $this->text($usage->visitTreatment?->treatment?->name, 'Unknown Treatment');
            $quantityUsed = (int) ($usage->quantity_used ?? 0);
            $usageTable[] = [
                'inventoryItemId' => (int) ($usage->inventory_item_id ?? 0),
                'itemName' => $this->text($usage->inventoryItem?->item_name, $this->text($usage->item_name, 'Unknown Item')),
                'patientName' => $this->patientName($patient, $usage->visitTreatment?->visit?->patient_id),
                'quantityUsed' => $quantityUsed,
                'treatmentName' => $treatmentName,
                'unit' => $this->text($usage->unit, $this->text($usage->inventoryItem?->unit, 'unit')),
                'usedOn' => $this->dateString($usage->visitTreatment?->visit?->visit_date),
            ];

            $usageByTreatment[$treatmentName] ??= ['quantityUsed' => 0, 'treatmentName' => $treatmentName];
            $usageByTreatment[$treatmentName]['quantityUsed'] += $quantityUsed;
        }

        $adjustmentRows = [];
        $adjustmentTrend = [];
        $wasteQuantity = 0;
        $lossQuantity = 0;
        $wasteValue = 0.0;
        $lossValue = 0.0;

        foreach ($adjustments as $adjustment) {
            $adjustmentType = $this->text($adjustment->adjustment_type, 'waste');
            $quantity = (int) ($adjustment->quantity ?? 0);
            $valueImpact = $this->decimal($adjustment->total_cost_impact ?? 0);
            $date = $this->dateString($adjustment->adjustment_date);
            $bucketDate = $this->parseDate($date);

            if ($adjustmentType === 'loss') {
                $lossQuantity += $quantity;
                $lossValue += $valueImpact;
            } else {
                $wasteQuantity += $quantity;
                $wasteValue += $valueImpact;
            }

            if ($bucketDate !== null) {
                $bucket = $this->granularityBucket($bucketDate, 'month');
                $adjustmentTrend[$bucket['key']] ??= [
                    'key' => $bucket['key'],
                    'label' => $bucket['label'],
                    'lossQuantity' => 0,
                    'sort' => $bucket['sort'],
                    'wasteQuantity' => 0,
                    'valueImpact' => 0.0,
                ];
                $adjustmentTrend[$bucket['key']][$adjustmentType === 'loss' ? 'lossQuantity' : 'wasteQuantity'] += $quantity;
                $adjustmentTrend[$bucket['key']]['valueImpact'] = $this->decimal($adjustmentTrend[$bucket['key']]['valueImpact'] + $valueImpact);
            }

            $adjustmentRows[] = [
                'adjustmentDate' => $date,
                'adjustmentType' => $adjustmentType,
                'itemName' => $this->text($adjustment->inventoryItem?->item_name, "Item #{$adjustment->inventory_item_id}"),
                'notes' => $this->text($adjustment->notes),
                'quantity' => $quantity,
                'supplier' => $this->text($adjustment->inventoryItem?->supplier),
                'totalCostImpact' => $valueImpact,
                'unit' => $this->text($adjustment->inventoryItem?->unit, 'unit'),
            ];
        }

        $implantStockRows = array_values(array_filter($stockRows, static function (array $row): bool {
            $haystack = mb_strtolower(($row['itemName'] ?? '').' '.($row['category'] ?? ''));

            return str_contains($haystack, 'implant');
        }));

        $adjustmentTrendRows = array_values($adjustmentTrend);
        usort($adjustmentTrendRows, static fn (array $left, array $right): int => $left['sort'] <=> $right['sort']);

        return [
            'summary' => [
                'criticalStockCount' => (int) (($availabilityBreakdown['out_of_stock']['count'] ?? 0)),
                'lowStockCount' => (int) (($availabilityBreakdown['low_stock']['count'] ?? 0)),
                'outOfStockCount' => (int) (($availabilityBreakdown['out_of_stock']['count'] ?? 0)),
                'stockPressureCount' => count($stockPressureRows),
                'totalItems' => count($stockRows),
                'totalQuantity' => $totalQuantity,
                'totalValue' => $this->decimal($totalValue),
                'wasteLossQuantity' => $wasteQuantity + $lossQuantity,
                'wasteLossValue' => $this->decimal($wasteValue + $lossValue),
            ],
            'charts' => [
                'availabilityBreakdown' => array_values($availabilityBreakdown),
                'categoryBreakdown' => array_values($categoryBreakdown),
                'wasteLossTrend' => $adjustmentTrendRows,
                'usageByTreatment' => array_slice($this->sortRows(array_values($usageByTreatment), 'quantityUsed'), 0, 20),
            ],
            'tables' => [
                'adjustmentRows' => array_slice($adjustmentRows, 0, 30),
                'implantStockRows' => array_slice($this->sortRows($implantStockRows, 'availableQuantity'), 0, 25),
                'stockPressureRows' => array_slice($this->sortRows($stockPressureRows, 'availableQuantity'), 0, 25),
                'stockRows' => array_slice($this->sortRows($stockRows, 'stockValue'), 0, 50),
                'usageRows' => array_slice($this->sortRows($usageTable, 'usedOn'), 0, 50),
            ],
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function audit(array $filters): array
    {
        [$startDate, $endDate] = $this->resolveDateRange($filters);
        $search = mb_strtolower($this->text($filters['search'] ?? ''));
        $operationsSnapshot = $this->operationsHealthService->buildSnapshot(8);
        $healthSummary = (array) ($operationsSnapshot['summary'] ?? []);
        $healthChecks = array_map(
            static fn (array $row): array => [
                'action' => (string) ($row['action'] ?? ''),
                'details' => (string) ($row['details'] ?? ''),
                'label' => (string) ($row['label'] ?? ''),
                'status' => (string) ($row['status'] ?? 'ok'),
                'value' => (string) ($row['value'] ?? ''),
            ],
            (array) ($operationsSnapshot['checks'] ?? [])
        );
        $recentBackups = array_map(
            static fn (array $row): array => [
                'completedAt' => (string) ($row['completedAt'] ?? ''),
                'fileSizeBytes' => (int) ($row['fileSizeBytes'] ?? 0),
                'id' => (int) ($row['id'] ?? 0),
                'mode' => (string) ($row['mode'] ?? ''),
                'notes' => (string) ($row['notes'] ?? ''),
                'status' => (string) ($row['status'] ?? ''),
            ],
            (array) ($operationsSnapshot['recentBackups'] ?? [])
        );

        $activityRows = ActivityLog::query()
            ->where('created_at', '>=', $startDate)
            ->where('created_at', '<=', $endDate)
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();

        $accessRows = ReportAccessLog::query()
            ->with('user:id,first_name,last_name,email')
            ->where('created_at', '>=', $startDate)
            ->where('created_at', '<=', $endDate)
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();

        $snapshotRows = ReportSnapshot::query()
            ->with('user:id,first_name,last_name,email')
            ->where('captured_at', '>=', $startDate)
            ->where('captured_at', '<=', $endDate)
            ->orderByDesc('captured_at')
            ->limit(200)
            ->get();

        $financialModifications = [];
        foreach ($activityRows as $activity) {
            $properties = is_array($activity->properties)
                ? $activity->properties
                : json_decode((string) $activity->properties, true);
            $oldValues = is_array($properties['old'] ?? null) ? $properties['old'] : [];
            $newValues = is_array($properties['attributes'] ?? null) ? $properties['attributes'] : [];
            $row = [
                'action' => $this->text($activity->event, $this->text($activity->description, 'updated')),
                'afterValue' => $newValues === [] ? '-' : json_encode($newValues, JSON_UNESCAPED_UNICODE),
                'beforeValue' => $oldValues === [] ? '-' : json_encode($oldValues, JSON_UNESCAPED_UNICODE),
                'changedBy' => $this->resolveAuditUserLabel((int) ($activity->causer_id ?? 0), $activity->causer_type),
                'entity' => class_basename((string) ($activity->subject_type ?? $activity->log_name ?? 'Unknown')),
                'timestamp' => $this->dateTimeString($activity->created_at),
            ];

            if ($search !== '' && !$this->auditRowMatches($row, $search)) {
                continue;
            }

            $financialModifications[] = $row;
        }

        $accessEntries = [];
        foreach ($accessRows as $access) {
            $meta = is_array($access->meta) ? $access->meta : [];
            $actorRoles = array_values(array_filter((array) ($meta['roles'] ?? []), static fn (mixed $value): bool => is_string($value) && $value !== ''));
            $actorRightLevel = $this->text($meta['rightLevel'] ?? '');
            $row = [
                'action' => $this->text($access->action, 'view'),
                'actorRightLevel' => $actorRightLevel,
                'actorRoles' => implode(', ', $actorRoles),
                'changedBy' => $this->personName($access->user),
                'entity' => 'Report/'.(string) $access->report_key,
                'timestamp' => $this->dateTimeString($access->created_at),
                'type' => 'access',
            ];
            if ($search !== '' && !$this->auditRowMatches($row, $search)) {
                continue;
            }
            $accessEntries[] = $row;
        }

        foreach ($snapshotRows as $snapshot) {
            $row = [
                'action' => 'snapshot_'.$this->text($snapshot->reason, 'manual'),
                'changedBy' => $this->personName($snapshot->user),
                'entity' => 'Report/'.(string) $snapshot->report_key,
                'timestamp' => $this->dateTimeString($snapshot->captured_at),
                'type' => 'snapshot',
            ];
            if ($search !== '' && !$this->auditRowMatches($row, $search)) {
                continue;
            }
            $accessEntries[] = $row;
        }

        $timeline = array_merge(
            array_map(static fn (array $row): array => $row + ['type' => 'modification'], $financialModifications),
            $accessEntries
        );
        $timeline = $this->sortRows($timeline, 'timestamp');

        return [
            'summary' => [
                'accessCount' => count($accessEntries),
                'backupStatus' => (string) ($healthSummary['status'] ?? 'warning'),
                'failedBackupCount' => (int) ($healthSummary['failedBackupCount'] ?? 0),
                'healthWarningCount' => (int) ($healthSummary['healthWarningCount'] ?? 0),
                'lastSuccessfulBackupAt' => $healthSummary['lastSuccessfulBackupAt'] ?? null,
                'lowDiskWarning' => (bool) ($healthSummary['lowDiskWarning'] ?? false),
                'modificationCount' => count($financialModifications),
                'snapshotCount' => count(array_filter($accessEntries, static fn (array $row): bool => $row['type'] === 'snapshot')),
            ],
            'financialModifications' => array_slice($financialModifications, 0, 100),
            'healthChecks' => $healthChecks,
            'recentBackups' => $recentBackups,
            'timeline' => array_slice($timeline, 0, 200),
        ];
    }

    private function taggedInputAmount(string $notes, string $inputKey, string $baseKey, string $currency, float $exchangeRate): float
    {
        $inputValue = $this->taggedText($notes, $inputKey);
        if ($inputValue !== '') {
            return $this->decimal($inputValue);
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

    private function auditRowMatches(array $row, string $search): bool
    {
        $haystack = mb_strtolower(implode(' ', array_map(static fn (mixed $value): string => (string) $value, $row)));

        return str_contains($haystack, $search);
    }

    private function resolveAuditUserLabel(int $causerId, ?string $causerType): string
    {
        if ($causerId <= 0 || $causerType !== User::class) {
            return 'System';
        }

        return $this->personName(User::query()->find($causerId), $causerId);
    }
}
