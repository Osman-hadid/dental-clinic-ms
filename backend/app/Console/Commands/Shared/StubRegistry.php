<?php

declare(strict_types=1);

namespace App\Console\Commands\Shared;

final class StubRegistry
{
    public const BACKEND = [

        // Infrastructure: HTTP Requests
        'store-request' => [
            'stub' => 'stubs/backend/store-request.stub',
            'output' => 'app/Modules/{{ module }}/Infrastructure/Http/Requests/{{ entity }}/Store{{ entity }}Request.php',
        ],
        'update-request' => [
            'stub' => 'stubs/backend/update-request.stub',
            'output' => 'app/Modules/{{ module }}/Infrastructure/Http/Requests/{{ entity }}/Update{{ entity }}Request.php',
        ],
        'list-request' => [
            'stub' => 'stubs/backend/list-request.stub',
            'output' => 'app/Modules/{{ module }}/Infrastructure/Http/Requests/{{ entity }}/List{{ entityPlural }}Request.php',
        ],
        'bulk-delete-request' => [
            'stub' => 'stubs/backend/bulk-delete-request.stub',
            'output' => 'app/Modules/{{ module }}/Infrastructure/Http/Requests/{{ entity }}/BulkDelete{{ entityPlural }}Request.php',
        ],

        // Application: DTOs
        'dto' => [
            'stub' => 'stubs/backend/dto.stub',
            'output' => 'app/Modules/{{ module }}/Application/DTOs/{{ entity }}Data.php',
        ],

        // Infrastructure: Resources
        'resource' => [
            'stub' => 'stubs/backend/resource.stub',
            'output' => 'app/Modules/{{ module }}/Infrastructure/Resources/{{ entity }}Resource.php',
        ],

        // Domain: Entities
        'model' => [
            'stub' => 'stubs/backend/model.stub',
            'output' => 'app/Modules/{{ module }}/Domain/Entities/{{ entity }}.php',
        ],

        // Application: UseCases
        'create-usecase' => [
            'stub' => 'stubs/backend/create-usecase.stub',
            'output' => 'app/Modules/{{ module }}/Application/UseCases/{{ entity }}/Create{{ entity }}UseCase.php',
        ],
        'delete-usecase' => [
            'stub' => 'stubs/backend/delete-usecase.stub',
            'output' => 'app/Modules/{{ module }}/Application/UseCases/{{ entity }}/Delete{{ entity }}UseCase.php',
        ],
        'get-usecase' => [
            'stub' => 'stubs/backend/get-usecase.stub',
            'output' => 'app/Modules/{{ module }}/Application/UseCases/{{ entity }}/Get{{ entity }}UseCase.php',
        ],
        'list-usecase' => [
            'stub' => 'stubs/backend/list-usecase.stub',
            'output' => 'app/Modules/{{ module }}/Application/UseCases/{{ entity }}/List{{ entityPlural }}UseCase.php',
        ],
        'update-usecase' => [
            'stub' => 'stubs/backend/update-usecase.stub',
            'output' => 'app/Modules/{{ module }}/Application/UseCases/{{ entity }}/Update{{ entity }}UseCase.php',
        ],
        'restore-usecase' => [
            'stub' => 'stubs/backend/restore-usecase.stub',
            'output' => 'app/Modules/{{ module }}/Application/UseCases/{{ entity }}/Restore{{ entity }}UseCase.php',
        ],
        'force-delete-usecase' => [
            'stub' => 'stubs/backend/force-delete-usecase.stub',
            'output' => 'app/Modules/{{ module }}/Application/UseCases/{{ entity }}/ForceDelete{{ entity }}UseCase.php',
        ],
        'bulk-delete-usecase' => [
            'stub' => 'stubs/backend/bulk-delete-usecase.stub',
            'output' => 'app/Modules/{{ module }}/Application/UseCases/{{ entity }}/BulkDelete{{ entityPlural }}UseCase.php',
        ],

        // Domain & Infrastructure: Repositories
        'repository-interface' => [
            'stub' => 'stubs/backend/repository-interface.stub',
            'output' => 'app/Modules/{{ module }}/Domain/Repositories/{{ entity }}RepositoryInterface.php',
        ],
        'repository-eloquent' => [
            'stub' => 'stubs/backend/repository-eloquent.stub',
            'output' => 'app/Modules/{{ module }}/Infrastructure/Repositories/Eloquent{{ entity }}Repository.php',
        ],

        // Domain: Services
        'service' => [
            'stub' => 'stubs/backend/service.stub',
            'output' => 'app/Modules/{{ module }}/Domain/Services/{{ entity }}Service.php',
        ],

        // Infrastructure: Controllers
        'controller' => [
            'stub' => 'stubs/backend/controller.stub',
            'output' => 'app/Modules/{{ module }}/Infrastructure/Http/Controllers/{{ entity }}Controller.php',
        ],

        // Application: Policies
        'policy' => [
            'stub' => 'stubs/backend/policy.stub',
            'output' => 'app/Modules/{{ module }}/Application/Policies/{{ entity }}Policy.php',
        ],
    ];

    public const FRONTEND = [

        // Presentation: Module Configuration
        'config' => [
            'stub' => 'stubs/frontend/config.stub',
            'output' => '../frontend/src/modules/{moduleKebab}/presentation/config/{entityKebab}-config.ts',
        ],

        // Infrastructure: Localization (i18n)
        'locale' => [
            'stub' => 'stubs/frontend/locale.stub',
            'output' => '../frontend/src/messages/{locale}/{moduleKebab}/{entityKebab}.json',
        ],

        // Domain: Types & Interfaces
        'type' => [
            'stub' => 'stubs/frontend/type.stub',
            'output' => '../frontend/src/modules/{moduleKebab}/domain/entities/{entity}.ts',
        ],
        'interface' => [
            'stub' => 'stubs/frontend/interface.stub',
            'output' => '../frontend/src/modules/{moduleKebab}/domain/interfaces/{entity}RepositoryInterface.ts',
        ],

        // Application: Use Cases
        'create-use-case' => [
            'stub' => 'stubs/frontend/create-use-case.stub',
            'output' => '../frontend/src/modules/{moduleKebab}/application/use-cases/{entityKebabPlural}/create-{entityKebab}-use-case.ts',
        ],
        'delete-use-case' => [
            'stub' => 'stubs/frontend/delete-use-case.stub',
            'output' => '../frontend/src/modules/{moduleKebab}/application/use-cases/{entityKebabPlural}/delete-{entityKebab}-use-case.ts',
        ],
        'get-use-case' => [
            'stub' => 'stubs/frontend/get-use-case.stub',
            'output' => '../frontend/src/modules/{moduleKebab}/application/use-cases/{entityKebabPlural}/get-{entityKebab}-use-case.ts',
        ],
        'list-use-case' => [
            'stub' => 'stubs/frontend/list-use-case.stub',
            'output' => '../frontend/src/modules/{moduleKebab}/application/use-cases/{entityKebabPlural}/list-{entityKebabPlural}-use-case.ts',
        ],
        'update-use-case' => [
            'stub' => 'stubs/frontend/update-use-case.stub',
            'output' => '../frontend/src/modules/{moduleKebab}/application/use-cases/{entityKebabPlural}/update-{entityKebab}-use-case.ts',
        ],

        // Infrastructure: Repositories
        'repository' => [
            'stub' => 'stubs/frontend/repository.stub',
            'output' => '../frontend/src/modules/{moduleKebab}/infrastructure/repositories/{entityKebab}-repository.ts',
        ],

        // Application: State Management
        'store' => [
            'stub' => 'stubs/frontend/store.stub',
            'output' => '../frontend/src/modules/{moduleKebab}/application/stores/{entityKebab}-store.ts',
        ],

        // Presentation: React Hooks
        'use-create' => [
            'stub' => 'stubs/frontend/use-create.stub',
            'output' => '../frontend/src/modules/{moduleKebab}/presentation/hooks/{entityKebabPlural}/useCreate{entity}.ts',
        ],
        'use-delete' => [
            'stub' => 'stubs/frontend/use-delete.stub',
            'output' => '../frontend/src/modules/{moduleKebab}/presentation/hooks/{entityKebabPlural}/useDelete{entity}.ts',
        ],
        'use-get' => [
            'stub' => 'stubs/frontend/use-get.stub',
            'output' => '../frontend/src/modules/{moduleKebab}/presentation/hooks/{entityKebabPlural}/useGet{entity}.ts',
        ],
        'use-list' => [
            'stub' => 'stubs/frontend/use-list.stub',
            'output' => '../frontend/src/modules/{moduleKebab}/presentation/hooks/{entityKebabPlural}/use{entity}List.ts',
        ],
        'use-update' => [
            'stub' => 'stubs/frontend/use-update.stub',
            'output' => '../frontend/src/modules/{moduleKebab}/presentation/hooks/{entityKebabPlural}/useUpdate{entity}.ts',
        ],
        'index' => [
            'stub' => 'stubs/frontend/index.stub',
            'output' => '../frontend/src/modules/{moduleKebab}/presentation/hooks/index.ts',
        ],

        // Presentation: Pages
        'page' => [
            'stub' => 'stubs/frontend/page.stub',
            'output' => '../frontend/src/app/[locale]/{moduleKebab}/{entityKebabPlural}/page.tsx',
        ],

        // Infrastructure: nextInt i18n Request
        'request' => [
            'stub' => 'stubs/frontend/request.stub',
            'output' => '../frontend/src/i18n/request.ts',
        ],
    ];

    public static function get(string $environment): array
    {
        return match ($environment) {
            'backend' => self::BACKEND,
            'frontend' => self::FRONTEND,
            default => throw new \InvalidArgumentException("Unknown environment: {$environment}"),
        };
    }
}
