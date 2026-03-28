<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Models\User;

final class WorkflowAccessService
{
    private const RIGHTS_ORDER = [
        'create' => 1,
        'review' => 2,
        'approval' => 3,
    ];

    public function rightLevel(?User $user): string
    {
        if ($this->isSuperAdmin($user)) {
            return 'approval';
        }

        $raw = is_string($user?->rights) ? strtolower(trim((string) $user->rights)) : '';

        return array_key_exists($raw, self::RIGHTS_ORDER) ? $raw : 'create';
    }

    public function hasAtLeast(?User $user, string $required): bool
    {
        $current = self::RIGHTS_ORDER[$this->rightLevel($user)] ?? 0;
        $target = self::RIGHTS_ORDER[$required] ?? PHP_INT_MAX;

        return $current >= $target;
    }

    public function canViewClinicalReports(?User $user): bool
    {
        return $this->hasDentalView($user) && $this->hasAtLeast($user, 'create');
    }

    public function canViewInventoryReports(?User $user): bool
    {
        return $this->hasDentalView($user) && $this->hasAtLeast($user, 'create');
    }

    public function canViewExecutiveReports(?User $user): bool
    {
        return $this->hasDentalView($user) && $this->hasAtLeast($user, 'create');
    }

    public function canViewFinancialReports(?User $user): bool
    {
        return $this->hasDentalView($user) && $this->hasAtLeast($user, 'review');
    }

    public function canViewAuditReports(?User $user): bool
    {
        return $this->hasDentalView($user) && $this->hasAtLeast($user, 'approval');
    }

    public function canViewFinancialControl(?User $user): bool
    {
        return $this->canViewFinancialReports($user);
    }

    public function canCloseFinancialDay(?User $user): bool
    {
        return $this->canViewFinancialControl($user) && $this->hasAtLeast($user, 'approval');
    }

    public function canViewSafeLedger(?User $user): bool
    {
        return $this->canViewFinancialReports($user);
    }

    public function canManageSafeLedger(?User $user): bool
    {
        return $this->hasDentalView($user) && $this->hasAtLeast($user, 'approval');
    }

    public function canViewBackups(?User $user): bool
    {
        return (bool) $user?->can('dental-management.backups.view') && $this->hasAtLeast($user, 'review');
    }

    public function canRunBackups(?User $user): bool
    {
        return (bool) $user?->can('dental-management.backups.create') && $this->hasAtLeast($user, 'review');
    }

    public function canManageBackupSettings(?User $user): bool
    {
        return (bool) $user?->can('dental-management.backups.update') && $this->hasAtLeast($user, 'approval');
    }

    public function canUpdatePayments(?User $user): bool
    {
        return (bool) $user?->can('dental-management.payments.update') && $this->hasAtLeast($user, 'review');
    }

    public function canDeletePayments(?User $user): bool
    {
        return (bool) $user?->can('dental-management.payments.delete') && $this->hasAtLeast($user, 'approval');
    }

    public function canDeleteInvoices(?User $user): bool
    {
        return (bool) $user?->can('dental-management.invoices.delete') && $this->hasAtLeast($user, 'approval');
    }

    public function canDeleteVisitFinancialRecords(?User $user): bool
    {
        return $this->canDeletePayments($user) && $this->canDeleteInvoices($user);
    }

    public function canUpdateExchangeRate(?User $user): bool
    {
        return $this->hasDentalView($user) && $this->hasAtLeast($user, 'approval');
    }

    public function canAccessReport(?User $user, string $reportKey): bool
    {
        $normalized = strtolower(trim($reportKey));

        return match ($normalized) {
            'audit' => $this->canViewAuditReports($user),
            'financial', 'debts', 'safe', 'salaries', 'shareholders', 'daily-expenses', 'clinical-expenses' => $this->canViewFinancialReports($user),
            'reports', 'executive', 'clinical', 'inventory' => $this->canViewExecutiveReports($user),
            default => $this->hasDentalView($user),
        };
    }

    public function canManageSnapshots(?User $user): bool
    {
        return $this->canViewAuditReports($user);
    }

    /**
     * @return array<string, mixed>
     */
    public function summary(?User $user): array
    {
        $roles = $user?->roles?->pluck('name')->values()->all() ?? [];

        return [
            'capabilities' => [
                'canAccessAuditReports' => $this->canViewAuditReports($user),
                'canAccessClinicalReports' => $this->canViewClinicalReports($user),
                'canAccessExecutiveReports' => $this->canViewExecutiveReports($user),
                'canAccessFinancialReports' => $this->canViewFinancialReports($user),
                'canAccessFinancialSubreports' => $this->canViewFinancialReports($user),
                'canAccessInventoryReports' => $this->canViewInventoryReports($user),
                'canCloseFinancialDay' => $this->canCloseFinancialDay($user),
                'canDeleteInvoices' => $this->canDeleteInvoices($user),
                'canDeletePayments' => $this->canDeletePayments($user),
                'canManageBackupSettings' => $this->canManageBackupSettings($user),
                'canManageSafeLedger' => $this->canManageSafeLedger($user),
                'canManageSnapshots' => $this->canManageSnapshots($user),
                'canRunBackups' => $this->canRunBackups($user),
                'canUpdateExchangeRate' => $this->canUpdateExchangeRate($user),
                'canUpdatePayments' => $this->canUpdatePayments($user),
                'canViewBackups' => $this->canViewBackups($user),
                'canViewFinancialControl' => $this->canViewFinancialControl($user),
                'canViewSafeLedger' => $this->canViewSafeLedger($user),
            ],
            'requirements' => [
                [
                    'action' => 'Close financial day',
                    'allowed' => $this->canCloseFinancialDay($user),
                    'requiredRight' => 'approval',
                    'reason' => 'Only approval-level users can save the day close and sign reconciliation.',
                ],
                [
                    'action' => 'Delete payments and invoices',
                    'allowed' => $this->canDeleteVisitFinancialRecords($user),
                    'requiredRight' => 'approval',
                    'reason' => 'Financial deletion is restricted to approval-level users.',
                ],
                [
                    'action' => 'Manage backup settings',
                    'allowed' => $this->canManageBackupSettings($user),
                    'requiredRight' => 'approval',
                    'reason' => 'Changing automatic backup rules requires approval-level access.',
                ],
                [
                    'action' => 'Open audit reports',
                    'allowed' => $this->canViewAuditReports($user),
                    'requiredRight' => 'approval',
                    'reason' => 'Audit reports are reserved for approval-level users.',
                ],
                [
                    'action' => 'View financial and debt reports',
                    'allowed' => $this->canViewFinancialReports($user),
                    'requiredRight' => 'review',
                    'reason' => 'Financial reporting requires at least review-level access.',
                ],
            ],
            'user' => [
                'permissionCount' => $user?->getAllPermissions()->count() ?? 0,
                'rightLevel' => $this->rightLevel($user),
                'roles' => $roles,
            ],
        ];
    }

    private function hasDentalView(?User $user): bool
    {
        return (bool) $user?->can('dental-management.view');
    }

    private function isSuperAdmin(?User $user): bool
    {
        return (bool) $user?->hasRole('super-admin');
    }
}
