<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Models\ActivityLog;
use App\Models\User;
use App\Modules\DentalManagement\Domain\Entities\Expense;
use App\Modules\DentalManagement\Domain\Entities\InventoryItem;
use App\Modules\DentalManagement\Domain\Entities\ReportAccessLog;
use App\Modules\DentalManagement\Domain\Entities\ReportSnapshot;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Domain\Entities\Shareholder;
use App\Modules\DentalManagement\Domain\Entities\Staff;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatmentMaterial;
use App\Modules\DentalManagement\Domain\Services\Concerns\InteractsWithReportData;
use Carbon\CarbonImmutable;

final class ReportDashboardService
{
    use InteractsWithReportData;

    public function __construct(
        private readonly ExecutiveReportSummaryService $executiveReportSummaryService,
        private readonly ReportDatasetService $reportDatasetService,
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

        foreach (($dataset['invoiceRows'] ?? []) as $invoice) {
            $invoiceId = (string) ($invoice['id'] ?? '');
            $patientId = (string) ($invoice['patientId'] ?? '');
            $visitId = (string) ($invoice['visitId'] ?? '');
            $invoiceDate = $this->text($invoice['invoiceDate'] ?? '');
            $billedAmount = $this->decimal($invoice['totalAmountInput'] ?? $invoice['totalAmount'] ?? 0);
            $netAmount = $this->decimal($invoice['netAmountInput'] ?? $invoice['netAmount'] ?? 0);
            $billed += $billedAmount;
            $net += $netAmount;

            $invoicePaid = 0.0;
            foreach (($invoice['payments'] ?? []) as $payment) {
                $amount = $this->decimal($payment['amountInput'] ?? $payment['amount'] ?? 0);
                $invoicePaid += $amount;
                $paid += $amount;

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
                $outstandingRows[] = [
                    'debtAmount' => $this->decimal($debt),
                    'invoiceDate' => $invoiceDate,
                    'invoiceId' => $invoiceId,
                    'netAmount' => $netAmount,
                    'paidAmount' => $this->decimal($invoicePaid),
                    'patientId' => $patientId,
                    'patientName' => $patientNameMap[$patientId] ?? $this->patientName(null, $patientId),
                    'status' => $invoiceStatus,
                ];
                $outstandingTotal += $debt;
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
            $amount = $this->decimal($expense['amountInput'] ?? $expense['amount'] ?? 0);
            $category = $this->text($expense['category'] ?? 'Other', 'Other');
            $expenseTotal += $amount;
            $expenseByCategory[$category] ??= ['amount' => 0.0, 'category' => $category];
            $expenseByCategory[$category]['amount'] = $this->decimal($expenseByCategory[$category]['amount'] + $amount);
        }

        $safeIn = 0.0;
        $safeOut = 0.0;
        $safeBalance = 0.0;
        $safeFlow = [];
        $safeLedger = [];
        foreach (($dataset['safeRows'] ?? []) as $row) {
            $amount = $this->decimal($row['amountInput'] ?? $row['amount'] ?? 0);
            $direction = $this->text($row['direction'] ?? 'in', 'in');
            $transactionDate = $this->text($row['transactionDate'] ?? '');
            if ($direction === 'out') {
                $safeOut += $amount;
            } else {
                $safeIn += $amount;
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
                'direction' => $direction,
                'entryType' => $this->text($row['entryType'] ?? '', 'adjustment'),
                'notes' => $this->text($row['notes'] ?? ''),
                'pickedByStaffName' => $this->text($row['pickedByStaffName'] ?? ''),
                'transactionDate' => $transactionDate,
            ];
        }

        $safeBalanceRows = SafeTransaction::query()
            ->select(['direction', 'amount_input', 'amount'])
            ->get();

        foreach ($safeBalanceRows as $balanceRow) {
            $amount = $this->decimal($balanceRow->amount_input ?? $balanceRow->amount ?? 0);
            $safeBalance += ($balanceRow->direction ?? 'in') === 'out' ? -$amount : $amount;
        }

        $salaryPaid = 0.0;
        foreach (($dataset['salaryRows'] ?? []) as $salary) {
            if (in_array((string) ($salary['status'] ?? ''), ['paid', 'partial'], true)) {
                $salaryPaid += $this->decimal($salary['netAmountInput'] ?? $salary['netAmount'] ?? 0);
            }
        }

        $shareholderContribution = 0.0;
        $shareholderDistribution = 0.0;
        $shareholderLedger = [];
        foreach (($dataset['shareholderTransactionRows'] ?? []) as $transaction) {
            $amount = $this->decimal($transaction['amountInput'] ?? $transaction['amount'] ?? 0);
            $type = $this->text($transaction['transactionType'] ?? 'contribution', 'contribution');
            if ($type === 'distribution') {
                $shareholderDistribution += $amount;
            } else {
                $shareholderContribution += $amount;
            }

            $shareholderLedger[] = [
                'amount' => $amount,
                'notes' => $this->text($transaction['notes'] ?? ''),
                'shareholderId' => (string) ($transaction['shareholderId'] ?? ''),
                'shareholderName' => $this->text($transaction['shareholderName'] ?? '', 'Unknown Shareholder'),
                'transactionDate' => $this->text($transaction['transactionDate'] ?? ''),
                'transactionType' => $type,
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
            $supplierTotal = $this->taggedAmount($notes, 'supplier_total');
            $supplierPaid = min($supplierTotal, $this->taggedAmount($notes, 'supplier_paid'));
            $implantInstallments[] = [
                'availability' => $this->taskAvailability($notes, $this->text($task['status'] ?? 'pending')),
                'createdAt' => $this->dateTimeString($task['createdAt'] ?? ''),
                'patientId' => $patientId,
                'patientName' => $patientNameMap[$patientId] ?? $this->patientName(null, $patientId),
                'supplierPaid' => $this->decimal($supplierPaid),
                'supplierRemaining' => $this->decimal(max(0, $supplierTotal - $supplierPaid)),
                'supplierTotal' => $this->decimal($supplierTotal),
                'toothNumber' => $this->implantToothNumber($notes, $title) ?? '-',
            ];
        }

        $collectionRate = $net > 0 ? round(min(100, ($paid / $net) * 100), 1) : 0.0;
        $revenueTrendRows = array_values($revenueTrend);
        usort($revenueTrendRows, static fn (array $left, array $right): int => $left['sort'] <=> $right['sort']);
        $safeFlowRows = array_values($safeFlow);
        usort($safeFlowRows, static fn (array $left, array $right): int => $left['sort'] <=> $right['sort']);

        return [
            'summary' => [
                'billed' => $this->decimal($billed),
                'collectionRate' => $collectionRate,
                'expenses' => $this->decimal($expenseTotal),
                'net' => $this->decimal($net),
                'outstanding' => $this->decimal($outstandingTotal),
                'paid' => $this->decimal($paid),
                'safeBalance' => $this->decimal(max(0, $safeBalance)),
                'safeIn' => $this->decimal($safeIn),
                'safeOut' => $this->decimal($safeOut),
                'salaryPaid' => $this->decimal($salaryPaid),
                'shareholderContribution' => $this->decimal($shareholderContribution),
                'shareholderDistribution' => $this->decimal($shareholderDistribution),
            ],
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

        return [
            'summary' => [
                'appointments' => count($dataset['appointments'] ?? []),
                'completedAppointments' => (int) (($appointmentStatusBreakdown['completed']['count'] ?? 0)),
                'implantCases' => count($implantCases),
                'patients' => count($dataset['patients'] ?? []),
                'prescriptions' => count($prescriptionRows),
                'visitTreatments' => count($dataset['visitTreatments'] ?? []),
                'visits' => count($dataset['visits'] ?? []),
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
                'prescriptions' => array_slice($this->sortRows($prescriptionRows, 'createdAt'), 0, 25),
                'treatmentPerformance' => array_slice($executive['treatmentVolume'] ?? [], 0, 25),
            ],
        ];
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

        $stockRows = [];
        $availabilityBreakdown = [];
        $categoryBreakdown = [];
        $totalQuantity = 0;
        $totalValue = 0.0;

        foreach ($inventoryItems as $item) {
            $consumedQuantity = max(0, (int) round((float) ($item->consumed_quantity ?? 0)));
            $quantity = (int) ($item->quantity ?? 0);
            $availableQuantity = max(0, $quantity - $consumedQuantity);
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

        $implantStockRows = array_values(array_filter($stockRows, static function (array $row): bool {
            $haystack = mb_strtolower(($row['itemName'] ?? '').' '.($row['category'] ?? ''));

            return str_contains($haystack, 'implant');
        }));

        return [
            'summary' => [
                'lowStockCount' => (int) (($availabilityBreakdown['low_stock']['count'] ?? 0)),
                'outOfStockCount' => (int) (($availabilityBreakdown['out_of_stock']['count'] ?? 0)),
                'totalItems' => count($stockRows),
                'totalQuantity' => $totalQuantity,
                'totalValue' => $this->decimal($totalValue),
            ],
            'charts' => [
                'availabilityBreakdown' => array_values($availabilityBreakdown),
                'categoryBreakdown' => array_values($categoryBreakdown),
                'usageByTreatment' => array_slice($this->sortRows(array_values($usageByTreatment), 'quantityUsed'), 0, 20),
            ],
            'tables' => [
                'implantStockRows' => array_slice($this->sortRows($implantStockRows, 'availableQuantity'), 0, 25),
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
            $row = [
                'action' => $this->text($access->action, 'view'),
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
                'modificationCount' => count($financialModifications),
                'snapshotCount' => count(array_filter($accessEntries, static fn (array $row): bool => $row['type'] === 'snapshot')),
            ],
            'financialModifications' => array_slice($financialModifications, 0, 100),
            'timeline' => array_slice($timeline, 0, 200),
        ];
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
