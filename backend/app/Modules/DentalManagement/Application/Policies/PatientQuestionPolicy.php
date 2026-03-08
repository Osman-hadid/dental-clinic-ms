<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

final class PatientQuestionPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('dental-management.patient-questions.view');
    }

    public function view(User $user): bool
    {
        return $user->can('dental-management.patient-questions.view');
    }

    public function create(User $user): bool
    {
        return $user->can('dental-management.patient-questions.create');
    }

    public function update(User $user): bool
    {
        return $user->can('dental-management.patient-questions.update');
    }

    public function delete(User $user): bool
    {
        return $user->can('dental-management.patient-questions.delete');
    }

    public function restore(User $user): bool
    {
        return $user->can('dental-management.patient-questions.restore');
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('dental-management.patient-questions.force-delete');
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('dental-management.patient-questions.bulk-delete');
    }
}
