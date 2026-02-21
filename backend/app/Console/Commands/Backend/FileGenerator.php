<?php

declare(strict_types=1);

namespace App\Console\Commands\Backend;

use App\Console\Commands\Shared\Naming;
use App\Console\Commands\Shared\StubRegistry;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Symfony\Component\Console\Output\OutputInterface;

final readonly class FileGenerator
{
    /*
     * TODO: Needs refactoring. NOSONAR
     */

    public function __construct(private OutputInterface $output, private array $fields = []) {}

    public function generate(string $module, string $entity, array $replacements): void
    {
        $allNaming = Naming::all($module, $entity);

        $replacements = [...$replacements, ...$allNaming];

        $modulePascal = $allNaming['modulePascal'];
        $entityPascal = $allNaming['entityPascal'];
        $entityPluralPascal = $allNaming['entityPascalPlural'];

        $stubs = StubRegistry::get('backend');

        foreach ($stubs as $stub) {
            $stubPath = base_path($stub['stub']);

            // Replace placeholders in output path
            $outputPath = str_replace(
                ['{{ module }}', '{{ entity }}', '{{ entityPlural }}'],
                [$modulePascal, $entityPascal, $entityPluralPascal],
                $stub['output']
            );
            $dest = base_path($outputPath);

            $template = File::get($stubPath);
            $filled = $this->fillTemplate($template, $replacements);

            File::ensureDirectoryExists(dirname($dest));
            File::put($dest, $filled);
            $this->output->writeln("Created: {$dest}");
        }

        // Append service provider binding
        $this->appendServiceProvider($module, $entityPascal, $replacements);

        // Append routes
        $this->appendRoutes($module, $entityPascal, $replacements);

        $this->registerModuleProvider($module);

        $this->updateLocalizationFile($module, $entityPascal);

        $this->appendPolicyToServiceProvider($module, $entityPascal);
    }

    private function appendServiceProvider(string $module, string $entity, array $replacements): void
    {
        $modulePascal = Naming::modulePascal($module);
        $dest = base_path("app/Modules/{$module}/Infrastructure/Providers/{$modulePascal}ServiceProvider.php");
        $stub = File::get(base_path('stubs/backend/service-provider.stub'));
        $filled = $this->fillTemplate($stub, $replacements);

        $interfaceUse = "use App\\Modules\\{$module}\\Domain\\Repositories\\{$entity}RepositoryInterface;";
        $eloquentUse = "use App\\Modules\\{$module}\\Infrastructure\\Repositories\\Eloquent{$entity}Repository;";

        if (!File::exists($dest)) {
            File::ensureDirectoryExists(dirname($dest));
            File::put($dest, $filled);
            $this->output->writeln("Created: {$dest}");

            return;
        }

        $existingContent = File::get($dest);

        // Prevent duplicate bindings
        $binding = "\$this->app->bind(abstract: {$entity}RepositoryInterface::class, concrete: Eloquent{$entity}Repository::class);";
        if (Str::contains($existingContent, $binding)) {
            $this->output->writeln("Binding for {$entity} already exists in {$dest}, skipping.");

            return;
        }

        // Inject use statements after namespace
        $lines = explode("\n", $existingContent);
        $namespaceIndex = collect($lines)->search(fn ($line) => Str::startsWith(trim($line), 'namespace '));
        $insertIndex = $namespaceIndex !== false ? $namespaceIndex + 1 : 1;

        $existingUses = collect($lines)->filter(fn ($line) => Str::startsWith(trim($line), 'use'))->map('trim')->all();

        if (!\in_array(trim($interfaceUse), $existingUses)) {
            array_splice($lines, $insertIndex, 0, $interfaceUse);
            $insertIndex++;
        }

        if (!\in_array(trim($eloquentUse), $existingUses)) {
            array_splice($lines, $insertIndex, 0, $eloquentUse);
        }

        // Inject binding into registerBindings()
        $newBinding = $this->fillTemplate(
            '        $this->app->bind(abstract: {{ entity }}RepositoryInterface::class, concrete: Eloquent{{ entity }}Repository::class);',
            $replacements
        );

        $lines = preg_replace_callback(
            '/(protected function registerBindings\(\): void\s*{)/',
            fn ($match): string => "{$match[1]}\n{$newBinding}",
            implode("\n", $lines)
        );

        File::put($dest, $lines);
        $this->output->writeln("Appended binding to: {$dest}");
    }

    private function appendRoutes(string $module, string $entity, array $replacements): void
    {
        $moduleSnake = Naming::moduleSnake($module);
        $entityKebabPlural = $replacements['entityKebabPlural'];
        $controllerClass = "App\\Modules\\{$module}\\Infrastructure\\Http\\Controllers\\{$entity}Controller";

        $dest = base_path("app/Modules/{$module}/Routes/api.php");

        if (!File::exists($dest)) {
            File::ensureDirectoryExists(dirname($dest));
            $content = "<?php\n\nuse {$controllerClass};\nuse Illuminate\Support\Facades\Route;\n\nRoute::middleware(['api', 'auth:sanctum', 'set_locale'])->prefix('api/v1/{$moduleSnake}')->group(function (): void {\n";
            $content .= "    Route::post('/{$entityKebabPlural}/restore/{id}', [{$entity}Controller::class, 'restore']);\n";
            $content .= "    Route::delete('/{$entityKebabPlural}/force/{id}', [{$entity}Controller::class, 'forceDelete']);\n";
            $content .= "    Route::delete('/{$entityKebabPlural}/bulk', [{$entity}Controller::class, 'bulkDelete']);\n";
            $content .= "    Route::apiResource('{$entityKebabPlural}', {$entity}Controller::class);\n";
            $content .= '});';
            File::put($dest, $content);
            $this->output->writeln("Created: {$dest}");

            return;
        }

        $existingContent = File::get($dest);

        if (Str::contains($existingContent, "Route::apiResource('{$entityKebabPlural}',")) {
            $this->output->writeln("Route for {$entityKebabPlural} already exists in {$dest}, skipping.");

            return;
        }

        $useStatements = [];
        $routeLines = [];
        $inGroup = false;
        $lines = explode("\n", $existingContent);

        foreach ($lines as $line) {
            if (preg_match('/^use\s+[^;]+;/', $line)) {
                $useStatements[] = trim($line);
            } elseif (Str::contains($line, "Route::middleware(['api', 'auth:sanctum', 'set_locale'])->prefix('api/v1/{$moduleSnake}')->group(function (): void {")) {
                $inGroup = true;
            } elseif ($inGroup && Str::contains($line, '});')) {
                $inGroup = false;
            } elseif ($inGroup && trim($line) !== '') {
                $routeLines[] = trim($line);
            }
        }

        // Add new use statements
        $useStatements[] = "use {$controllerClass};";
        $useStatements[] = 'use Illuminate\Support\Facades\Route;';
        $useStatements = array_unique($useStatements);
        sort($useStatements);

        // Add new routes
        $routeLines[] = "Route::post('/{$entityKebabPlural}/restore/{id}', [{$entity}Controller::class, 'restore']);";
        $routeLines[] = "Route::delete('/{$entityKebabPlural}/force/{id}', [{$entity}Controller::class, 'forceDelete']);";
        $routeLines[] = "Route::delete('/{$entityKebabPlural}/bulk', [{$entity}Controller::class, 'bulkDelete']);";
        $routeLines[] = "Route::apiResource('{$entityKebabPlural}', {$entity}Controller::class);";
        $routeLines = array_unique($routeLines);

        // Rebuild file
        $newContent = "<?php\n\n";
        $newContent .= implode("\n", $useStatements)."\n\n";
        $newContent .= "Route::middleware(['api', 'auth:sanctum', 'set_locale'])->prefix('api/v1/{$moduleSnake}')->group(function (): void {\n";
        $newContent .= '    '.implode("\n    ", $routeLines)."\n";
        $newContent .= '});';

        File::put($dest, $newContent);
        $this->output->writeln("Appended route to: {$dest}");
    }

    private function fillTemplate(string $template, array $replacements): string
    {
        $hasManyRelationships = collect($this->fields)
            ->filter(fn ($f): bool => isset($f['relationship']) && $f['relationship']['type'] === 'HasMany')
            ->pluck('relationship.name')
            ->map(fn ($name): string => "'{$name}'")
            ->implode(', ');

        $additional = [
            '{{ withHasMany }}' => $hasManyRelationships ? "with([$hasManyRelationships])->" : '',
            '{{ relationships }}' => $replacements['{{ relationships }}'] ?? '',
        ];

        $template = str_replace(
            array_keys($additional),
            array_values($additional),
            $template
        );

        return str_replace(
            array_keys($replacements),
            array_values($replacements),
            $template
        );
    }

    protected function registerModuleProvider(string $module): void
    {
        $modulePascal = Naming::modulePascal($module);
        $providerClass = "App\\Modules\\{$module}\\Infrastructure\\Providers\\{$modulePascal}ServiceProvider::class";
        $providerPath = base_path('bootstrap/providers.php');

        $contents = file_get_contents($providerPath);

        if (str_contains($contents, $providerClass)) {
            return;
        }

        $pattern = '/(return\s*\[\s*)(.*?)(\s*\];)/s';

        if (preg_match($pattern, $contents, $matches)) {
            $existing = trim($matches[2]);
            $newEntry = "    {$providerClass},";
            $newList = $existing !== '' && $existing !== '0' ? "{$existing}\n{$newEntry}" : $newEntry;
            $newContents = "return [\n{$newList}\n];";

            file_put_contents($providerPath, "<?php\n\n{$newContents}");
        }
    }

    protected function updateLocalizationFile(string $module, string $entity): void
    {
        $languages = ['en', 'dr', 'ps'];
        $translationKeys = $this->generateTranslationKeys($entity);

        foreach ($languages as $language) {
            $langPath = base_path("app/Modules/{$module}/Resources/lang/{$language}/messages.php");
            $this->createOrUpdateLangFile($langPath, $translationKeys);
        }
    }

    private function generateTranslationKeys(string $entity): array
    {
        $snake = Naming::entitySnake($entity);
        $plural = Str::snake(Str::plural($entity));
        $readable = Naming::entityHeadline($entity);
        $pluralReadable = Naming::entityHeadlinePlural($entity);

        return [
            "{$plural}.fetched" => "{$pluralReadable} fetched successfully.",
            "{$snake}.created" => "{$readable} created successfully.",
            "{$snake}.fetched" => "{$readable} fetched successfully.",
            "{$snake}.updated" => "{$readable} updated successfully.",
            "{$snake}.deleted" => "{$readable} deleted successfully.",
            "{$snake}.restored" => "{$readable} restored successfully.",
            "{$snake}.force_deleted" => "{$readable} force deleted successfully.",
            "{$plural}.bulk_deleted" => "{$pluralReadable} bulk deleted successfully.",
            "{$plural}.bulk_skipped" => "Some {$pluralReadable} were skipped due to related records.",
        ];
    }

    private function createOrUpdateLangFile(string $langPath, array $newKeys): void
    {
        if (!file_exists($langPath)) {
            $this->createLangFile($langPath, $newKeys);

            return;
        }

        $this->updateLangFile($langPath, $newKeys);
    }

    private function createLangFile(string $langPath, array $newKeys): void
    {
        $dir = dirname($langPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $content = $this->buildLangFileContent($newKeys);
        file_put_contents($langPath, $content);
        $this->output->writeln("Created localization file: {$langPath}");
    }

    private function updateLangFile(string $langPath, array $newKeys): void
    {
        $existing = include $langPath; // NOSONAR
        $merged = [...$existing, ...array_diff_key($newKeys, $existing)];

        $content = $this->buildLangFileContent($merged);
        file_put_contents($langPath, $content);
        $this->output->writeln("Updated localization file: {$langPath}");
    }

    private function buildLangFileContent(array $keys): string
    {
        $lines = ['<?php', '', 'return ['];
        foreach ($keys as $key => $value) {
            $lines[] = "    '{$key}' => '{$value}',";
        }
        $lines[] = '];';

        return implode("\n", $lines);
    }

    private function appendPolicyToServiceProvider(string $module, string $entity): void
    {
        $modulePascal = Naming::modulePascal($module);
        $providerPath = base_path("app/Modules/{$module}/Infrastructure/Providers/{$modulePascal}ServiceProvider.php");

        if (!file_exists($providerPath)) {
            $this->output->writeln("<error>Service provider not found: {$providerPath}</error>");

            return;
        }

        $content = file_get_contents($providerPath);

        $modelUse = "use App\\Modules\\{$module}\\Domain\\Entities\\{$entity};";
        $policyUse = "use App\\Modules\\{$module}\\Application\\Policies\\{$entity}Policy;";

        $policyLine = "        {$entity}::class => {$entity}Policy::class,";

        if (str_contains($content, $policyLine)) {
            $this->output->writeln("Policy already registered for {$entity}");

            return;
        }

        // Add use statements
        if (!str_contains($content, $modelUse)) {
            $content = preg_replace('/(namespace [^;]*+;)/', "$1\n{$modelUse}", $content, 1);
        }
        if (!str_contains($content, $policyUse)) {
            $content = preg_replace('/(namespace [^;]*+;)/', "$1\n{$policyUse}", $content, 1);
        }

        // Rebuild and sort $policies array
        $content = preg_replace_callback(
            '/(protected \$policies = \[)(.*?)(\];)/s',
            function (array $matches) use ($policyLine, $entity): string {
                $existingContent = $matches[2];

                preg_match_all("/\\b([A-Za-z]+)::class\s*=>\s*[A-Za-z]+Policy::class/", "{$existingContent}\n{$policyLine}", $found);
                $entities = $found[1] ?? [];

                $entities[] = $entity;
                $entities = array_unique($entities);
                sort($entities);

                $lines = [];
                foreach ($entities as $e) {
                    $lines[] = "        {$e}::class => {$e}Policy::class,";
                }

                $newContent = $lines !== [] ? implode("\n", $lines) : '';
                $insert = ($newContent !== '' && $newContent !== '0') ? "\n{$newContent}\n" : '';

                return "{$matches[1]}{$insert}{$matches[3]}";
            },
            $content,
            1
        );

        file_put_contents($providerPath, $content);
        $this->output->writeln("Policy registered and sorted: {$entity}");
    }
}
