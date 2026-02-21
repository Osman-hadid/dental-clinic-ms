<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Providers;

use App\Modules\DentalManagement\Application\Policies\AppointmentPolicy;
use App\Modules\DentalManagement\Application\Policies\InvoicePolicy;
use App\Modules\DentalManagement\Application\Policies\PatientPolicy;
use App\Modules\DentalManagement\Application\Policies\PaymentPolicy;
use App\Modules\DentalManagement\Application\Policies\StaffPolicy;
use App\Modules\DentalManagement\Application\Policies\ToothPolicy;
use App\Modules\DentalManagement\Application\Policies\TreatmentPolicy;
use App\Modules\DentalManagement\Application\Policies\VisitPolicy;
use App\Modules\DentalManagement\Application\Policies\VisitTreatmentPolicy;
use App\Modules\DentalManagement\Domain\Entities\Appointment;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Domain\Entities\Staff;
use App\Modules\DentalManagement\Domain\Entities\Tooth;
use App\Modules\DentalManagement\Domain\Entities\Treatment;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use App\Modules\DentalManagement\Domain\Repositories\AppointmentRepositoryInterface;
use App\Modules\DentalManagement\Domain\Repositories\InvoiceRepositoryInterface;
use App\Modules\DentalManagement\Domain\Repositories\PatientRepositoryInterface;
use App\Modules\DentalManagement\Domain\Repositories\PaymentRepositoryInterface;
use App\Modules\DentalManagement\Domain\Repositories\StaffRepositoryInterface;
use App\Modules\DentalManagement\Domain\Repositories\ToothRepositoryInterface;
use App\Modules\DentalManagement\Domain\Repositories\TreatmentRepositoryInterface;
use App\Modules\DentalManagement\Domain\Repositories\VisitRepositoryInterface;
use App\Modules\DentalManagement\Domain\Repositories\VisitTreatmentRepositoryInterface;
use App\Modules\DentalManagement\Infrastructure\Repositories\EloquentAppointmentRepository;
use App\Modules\DentalManagement\Infrastructure\Repositories\EloquentInvoiceRepository;
use App\Modules\DentalManagement\Infrastructure\Repositories\EloquentPatientRepository;
use App\Modules\DentalManagement\Infrastructure\Repositories\EloquentPaymentRepository;
use App\Modules\DentalManagement\Infrastructure\Repositories\EloquentStaffRepository;
use App\Modules\DentalManagement\Infrastructure\Repositories\EloquentToothRepository;
use App\Modules\DentalManagement\Infrastructure\Repositories\EloquentTreatmentRepository;
use App\Modules\DentalManagement\Infrastructure\Repositories\EloquentVisitRepository;
use App\Modules\DentalManagement\Infrastructure\Repositories\EloquentVisitTreatmentRepository;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as BaseAuthServiceProvider;

final class DentalManagementServiceProvider extends BaseAuthServiceProvider
{
    protected $policies = [
        Appointment::class => AppointmentPolicy::class,
        Invoice::class => InvoicePolicy::class,
        Patient::class => PatientPolicy::class,
        Payment::class => PaymentPolicy::class,
        Staff::class => StaffPolicy::class,
        Tooth::class => ToothPolicy::class,
        Treatment::class => TreatmentPolicy::class,
        Visit::class => VisitPolicy::class,
        VisitTreatment::class => VisitTreatmentPolicy::class,
    ];

    public function register(): void
    {
        $this->registerBindings();
    }

    public function boot(): void
    {
        $this->registerPolicies();

        $this->loadRoutesFrom(path: modulePath(module: 'DentalManagement', path: 'Routes/api.php'));
    }

    protected function registerBindings(): void
    {
        $this->app->bind(abstract: PaymentRepositoryInterface::class, concrete: EloquentPaymentRepository::class);
        $this->app->bind(abstract: InvoiceRepositoryInterface::class, concrete: EloquentInvoiceRepository::class);
        $this->app->bind(abstract: VisitTreatmentRepositoryInterface::class, concrete: EloquentVisitTreatmentRepository::class);
        $this->app->bind(abstract: TreatmentRepositoryInterface::class, concrete: EloquentTreatmentRepository::class);
        $this->app->bind(abstract: ToothRepositoryInterface::class, concrete: EloquentToothRepository::class);
        $this->app->bind(abstract: VisitRepositoryInterface::class, concrete: EloquentVisitRepository::class);
        $this->app->bind(abstract: AppointmentRepositoryInterface::class, concrete: EloquentAppointmentRepository::class);
        $this->app->bind(abstract: StaffRepositoryInterface::class, concrete: EloquentStaffRepository::class);
        $this->app->bind(abstract: PatientRepositoryInterface::class, concrete: EloquentPatientRepository::class);
    }
}
