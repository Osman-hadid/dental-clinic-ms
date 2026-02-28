<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\User;
use App\Modules\DentalManagement\Domain\Entities\Appointment;
use App\Modules\DentalManagement\Domain\Entities\Debt;
use App\Modules\DentalManagement\Domain\Entities\Expense;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Domain\Entities\SalaryPayment;
use App\Modules\DentalManagement\Domain\Entities\Staff;
use App\Modules\DentalManagement\Domain\Entities\Tooth;
use App\Modules\DentalManagement\Domain\Entities\Treatment;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use App\Modules\Settings\Domain\Entities\Module;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

final class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Relation::enforceMorphMap([
            'appointment' => Appointment::class,
            'debt' => Debt::class,
            'expense' => Expense::class,
            'invoice' => Invoice::class,
            'module' => Module::class,
            'patient' => Patient::class,
            'payment' => Payment::class,
            'safe_transaction' => SafeTransaction::class,
            'salary_payment' => SalaryPayment::class,
            'staff' => Staff::class,
            'tooth' => Tooth::class,
            'treatment' => Treatment::class,
            'user' => User::class,
            'visit' => Visit::class,
            'visit_treatment' => VisitTreatment::class,
        ]);

        Gate::before(static function (User $user): ?bool {
            return $user->hasRole('super-admin') ? true : null;
        });

        if (config('app.force_https')) {
            URL::forceScheme('https');
        }
    }
}
