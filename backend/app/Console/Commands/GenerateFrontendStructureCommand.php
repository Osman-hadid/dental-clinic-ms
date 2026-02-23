<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Console\Commands\Frontend\DtoParser;
use App\Console\Commands\Frontend\FileChecker;
use App\Console\Commands\Frontend\FileGenerator;
use App\Console\Commands\Frontend\Logger;
use App\Console\Commands\Frontend\RequestParser;
use App\Console\Commands\Shared\Naming;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;

final class GenerateFrontendStructureCommand extends Command
{
    protected $signature = 'generate:frontend {module} {entity}';

    protected $description = 'Generate full frontend CRUD structure from backend & migration';

    public function handle(
        FileChecker $fileChecker,
        DtoParser $dtoParser,
        RequestParser $requestParser,
        FileGenerator $fileGenerator,
        Logger $logger
    ): int {
        $module = $this->argument('module');
        $entity = $this->argument('entity');

        $this->info("Generating frontend for <fg=cyan>{$module}/{$entity}</>");

        $dtoPath = base_path("app/Modules/{$module}/Application/DTOs/{$entity}Data.php");

        if (!$fileChecker->check($dtoPath, "DTO not found: {$dtoPath}", $this, $logger)) {
            return 1;
        }

        try {
            $fields = $dtoParser->parse($dtoPath, $module, $entity);
            $requestFields = $requestParser->parse($module, $entity, $this, $logger);
            $fields = $this->mergeFields($fields, $requestFields);

            $fileGenerator->generate($module, $entity, $fields);

            $this->newLine();
            $this->info("Frontend generated successfully for <fg=green>{$module}/{$entity}</>!");

            $this->formatWithEslintAndPrettier($module);

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $logger->error('Generation failed: '.$e->getMessage(), $this);

            return self::FAILURE;
        }
    }

    private function mergeFields(array $fields, array $requestFields): array
    {
        foreach ($fields as &$field) {
            $name = $field['name'];
            if (isset($requestFields[$name])) {
                if (isset($requestFields[$name]['enum'])) {
                    $field['options'] = $requestFields[$name]['enum'];
                    $field['type'] = 'select';
                }
                if (isset($requestFields[$name]['relation'])) {
                    $field['relation'] = $requestFields[$name]['relation'];
                    $field['type'] = 'select';
                } elseif (isset($requestFields[$name]['type'])) {
                    $field['type'] = $requestFields[$name]['type'];
                }
                $field['required'] = $requestFields[$name]['required'] ?? false;
            } else {
                $field['required'] = false;
            }
        }

        return $fields;
    }

    private function formatWithEslintAndPrettier(string $module): void
    {
        $moduleKebab = Naming::moduleKebab($module);
        $frontendModulePath = base_path("../frontend/src/modules/{$moduleKebab}");

        if (!File::exists($frontendModulePath)) {
            $this->warn("Frontend module path not found: {$frontendModulePath}");

            return;
        }

        $frontendRoot = base_path('../frontend');

        // Detect package manager
        $hasYarn = File::exists("{$frontendRoot}/yarn.lock");
        $hasNpm = File::exists("{$frontendRoot}/package-lock.json");
        $hasPnpm = File::exists("{$frontendRoot}/pnpm-lock.yaml");

        if (!$hasYarn && !$hasNpm && !$hasPnpm) {
            $this->warn('Frontend package manager not detected. Skipping lint/format.');

            return;
        }

        $this->newLine();
        $this->info("Running ESLint and Prettier on module: <fg=cyan>{$moduleKebab}</>");

        $relativeModulePath = "src/modules/{$moduleKebab}/**";

        // Build targeted commands
        $lintCommand = $hasYarn || $hasPnpm
            ? "yarn lint:fix --quiet -- -- \"{$relativeModulePath}\""
            : "npm run lint:fix -- --quiet -- \"{$relativeModulePath}\"";

        $formatCommand = $hasYarn || $hasPnpm
            ? "yarn format --quiet \"{$relativeModulePath}\""
            : "npm run format -- --quiet \"{$relativeModulePath}\"";

        $commands = [$lintCommand, $formatCommand];

        foreach ($commands as $command) {
            $process = Process::path($frontendRoot)
                ->command($command)
                ->timeout(120)
                ->run();

            if (!$process->successful()) {
                $this->line("<fg=yellow>! Issues found and auto-fixed in {$moduleKebab}</>");
                if ($this->output->isVerbose()) {
                    $this->line($process->output());
                    $this->line($process->errorOutput());
                }
            }
        }

        $this->line('<fg=green>✓ Module formatted and linted successfully.</>');
    }
}
