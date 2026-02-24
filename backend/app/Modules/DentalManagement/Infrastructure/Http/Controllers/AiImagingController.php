<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\AiImaging\AnalyzeDentalImageRequest;
use Illuminate\Http\JsonResponse;
use Symfony\Component\Process\Process;

final class AiImagingController extends BaseApiController
{
    public function analyze(AnalyzeDentalImageRequest $request): JsonResponse
    {
        $file = $request->file('image');
        if (!$file) {
            return $this->errorResponse(
                code: 'VALIDATION_ERROR',
                message: 'Image is required.',
                details: ['image' => ['Image is required.']],
                httpCode: 422
            );
        }

        $modality = (string) ($request->validated('modality') ?? 'xray');
        $imagePath = (string) $file->getRealPath();
        $timeout = (int) config('services.ai_imaging.timeout', 120);

        [$detections, $errorMessage, $modelName, $detectorMeta] = $this->runDentalDiseaseDetector($imagePath, $timeout);
        if ($errorMessage !== null) {
            return $this->errorResponse(
                code: 'AI_ANALYSIS_FAILED',
                message: 'Dental disease detector failed.',
                details: $errorMessage,
                httpCode: 500
            );
        }

        $report = $this->buildDetectionOnlyReport($detections);
        $detectorWarning = $this->buildDetectorWarning($detectorMeta);

        return $this->successResponse(
            data: [
                'detections' => $detections,
                'detectorModel' => $modelName,
                'detectorMeta' => $detectorMeta,
                'detectorWarning' => $detectorWarning,
                'disclaimer' => 'Detection-only output from Dental Disease Detection model. Clinical interpretation required.',
                'model' => $modelName,
                'modality' => $modality,
                'provider' => 'dental_disease_detection',
                'rawText' => json_encode(['detections' => $detections], JSON_UNESCAPED_UNICODE) ?: '',
                'report' => $report,
            ],
            message: 'Dental disease detection completed.'
        );
    }

    private function runDentalDiseaseDetector(string $imagePath, int $timeout): array
    {
        $repoPath = trim((string) config('services.ai_imaging.dental_disease_detection.repo_path', ''));
        $scriptPath = trim((string) config('services.ai_imaging.dental_disease_detection.script_path', ''));
        $modelPath = trim((string) config('services.ai_imaging.dental_disease_detection.model_path', ''));
        $modelName = $modelPath !== '' ? basename($modelPath) : 'unknown-model';

        if (
            $repoPath === '' ||
            $scriptPath === '' ||
            $modelPath === '' ||
            !is_dir($repoPath) ||
            !file_exists($scriptPath) ||
            !file_exists($modelPath)
        ) {
            return [
                [],
                'Detector paths are not configured correctly. Ensure repo/script/model paths exist. '
                .'Expected model file at: '.$modelPath,
                $modelName,
                [],
            ];
        }

        $conf = $this->normalizeFloat(config('services.ai_imaging.dental_disease_detection.conf', 0.25), 0.25, 0.001, 0.99);
        $fallbackConf = $this->normalizeFloat(config('services.ai_imaging.dental_disease_detection.fallback_conf', 0.1), 0.1, 0.001, 0.99);
        $iou = $this->normalizeFloat(config('services.ai_imaging.dental_disease_detection.iou', 0.45), 0.45, 0.001, 0.99);
        $imgsz = $this->normalizeInt(config('services.ai_imaging.dental_disease_detection.imgsz', 1280), 1280, 320, 2048);
        $augment = $this->normalizeBool(config('services.ai_imaging.dental_disease_detection.augment', false));
        $multiPass = $this->normalizeBool(config('services.ai_imaging.dental_disease_detection.multi_pass', true));

        $pythonCommand = $this->resolvePythonCommand();
        $process = new Process(
            [
                ...$pythonCommand,
                $scriptPath,
                '--image',
                $imagePath,
                '--model',
                $modelPath,
                '--conf',
                (string) $conf,
                '--fallback-conf',
                (string) $fallbackConf,
                '--iou',
                (string) $iou,
                '--imgsz',
                (string) $imgsz,
                '--augment',
                $augment ? '1' : '0',
                '--multi-pass',
                $multiPass ? '1' : '0',
            ],
            $repoPath,
            $this->buildPythonProcessEnv($pythonCommand)
        );
        $process->setTimeout($timeout);

        try {
            $process->mustRun();
        } catch (\Throwable $exception) {
            $stderr = trim($process->getErrorOutput());
            $stdout = trim($process->getOutput());
            $message = $stderr !== '' ? $stderr : ($stdout !== '' ? $stdout : $exception->getMessage());
            return [[], 'Dental disease detector failed: '.$message, $modelName, []];
        }

        $decoded = json_decode(trim($process->getOutput()), true);
        if (!is_array($decoded)) {
            return [[], 'Detector returned invalid JSON output.', $modelName, []];
        }

        $meta = is_array($decoded['meta'] ?? null) ? $decoded['meta'] : [];

        return [$this->normalizeDetections($decoded['detections'] ?? []), null, $modelName, $meta];
    }

    private function normalizeDetections(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $normalized = [];
        foreach ($value as $item) {
            if (!is_array($item)) {
                continue;
            }

            $label = trim((string) ($item['label'] ?? ''));
            if ($label === '') {
                continue;
            }

            $normalized[] = [
                'confidence' => (float) ($item['confidence'] ?? 0),
                'label' => $label,
                'x1' => (int) ($item['x1'] ?? 0),
                'x2' => (int) ($item['x2'] ?? 0),
                'y1' => (int) ($item['y1'] ?? 0),
                'y2' => (int) ($item['y2'] ?? 0),
            ];
        }

        return $normalized;
    }

    private function buildDetectionOnlyReport(array $detections): array
    {
        if ($detections === []) {
            return [
                'confidence' => 0,
                'concerns' => [],
                'disclaimer' => 'Detection-only output from Dental Disease Detection model. Clinical interpretation required.',
                'findings' => ['No detections were found.'],
                'recommendations' => [
                    'Correlate with clinical examination.',
                    'If symptoms persist, consider additional imaging or specialist review.',
                ],
                'summary' => 'No findings detected by the model.',
                'urgency' => 'low',
            ];
        }

        $stats = [];
        $confidenceSum = 0.0;
        foreach ($detections as $detection) {
            $label = (string) $detection['label'];
            $confidence = (float) $detection['confidence'];

            if (!isset($stats[$label])) {
                $stats[$label] = [
                    'count' => 0,
                    'sum' => 0.0,
                    'max' => 0.0,
                ];
            }

            $stats[$label]['count']++;
            $stats[$label]['sum'] += $confidence;
            $stats[$label]['max'] = max($stats[$label]['max'], $confidence);
            $confidenceSum += $confidence;
        }
        uasort($stats, static function (array $a, array $b): int {
            if ($a['count'] === $b['count']) {
                return $b['max'] <=> $a['max'];
            }

            return $b['count'] <=> $a['count'];
        });

        $findings = [];
        $summaryParts = [];
        $concerns = [];
        $hasNonHealthy = false;

        foreach ($stats as $label => $values) {
            $count = (int) $values['count'];
            $avgConfidence = (int) round(($values['sum'] / max($count, 1)) * 100);
            $normalizedLabel = strtolower(trim($label));

            if ($normalizedLabel === 'healthy') {
                $findings[] = "Healthy pattern seen in {$count} region(s) (avg confidence {$avgConfidence}%).";
                $summaryParts[] = "healthy pattern in {$count} region(s)";
                continue;
            }

            $hasNonHealthy = true;
            $findings[] = "Possible {$label} in {$count} region(s) (avg confidence {$avgConfidence}%).";
            $concerns[] = "{$label} suspected in {$count} region(s).";
            $summaryParts[] = "{$label} in {$count} region(s)";
        }

        $avgConfidence = (int) round(($confidenceSum / max(count($detections), 1)) * 100);
        $summaryText = $summaryParts !== []
            ? 'Detected '.implode(', ', $summaryParts).'.'
            : 'Model detected findings but could not classify a stable summary.';

        return [
            'confidence' => $avgConfidence,
            'concerns' => $concerns,
            'disclaimer' => 'Detection-only output from Dental Disease Detection model. Clinical interpretation required.',
            'findings' => $findings,
            'recommendations' => [
                'Review detected labels with clinical context before treatment decisions.',
                'Use detection boxes as supporting evidence, not final diagnosis.',
                $hasNonHealthy
                    ? 'Prioritize clinical confirmation of non-healthy findings in the charted regions.'
                    : 'Maintain routine follow-up and preventive care based on exam findings.',
            ],
            'summary' => $summaryText,
            'urgency' => $hasNonHealthy ? 'moderate' : 'low',
        ];
    }

    private function resolvePythonCommand(): array
    {
        $configured = trim((string) config('services.ai_imaging.dental_disease_detection.python_bin', 'python'));
        $candidates = [];

        if ($configured !== '') {
            $candidates[] = $this->splitCommand($configured);
        }

        $candidates[] = ['python'];
        $candidates[] = ['python3'];
        $candidates[] = ['py', '-3'];
        $candidates[] = ['py'];

        foreach ($this->windowsPythonExecutables() as $pythonExe) {
            $candidates[] = [$pythonExe];
        }

        $seen = [];
        $uniqueCandidates = [];
        foreach ($candidates as $candidate) {
            if ($candidate === []) {
                continue;
            }

            $key = implode("\0", $candidate);
            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $uniqueCandidates[] = $candidate;
        }

        foreach ($uniqueCandidates as $candidate) {
            $probe = new Process([...$candidate, '--version']);
            $probe->setTimeout(8);
            $probe->run();
            if ($probe->isSuccessful()) {
                return $candidate;
            }
        }

        return $uniqueCandidates[0] ?? ['python'];
    }

    private function splitCommand(string $command): array
    {
        $trimmed = trim($command, " \t\n\r\0\x0B\"'");
        if ($trimmed === '') {
            return [];
        }

        if (file_exists($trimmed)) {
            return [$trimmed];
        }

        return preg_split('/\s+/', $trimmed, -1, PREG_SPLIT_NO_EMPTY) ?: [$trimmed];
    }

    private function buildPythonProcessEnv(array $pythonCommand): array
    {
        $env = [];
        $pythonExecutable = $pythonCommand[0] ?? '';
        $pythonDir = '';

        if (is_string($pythonExecutable) && $pythonExecutable !== '' && file_exists($pythonExecutable)) {
            $pythonDir = dirname($pythonExecutable);
        }

        $pathSegments = [];
        if ($pythonDir !== '') {
            $pathSegments[] = $pythonDir;
            $scriptsDir = $pythonDir.DIRECTORY_SEPARATOR.'Scripts';
            if (is_dir($scriptsDir)) {
                $pathSegments[] = $scriptsDir;
            }
        }

        $systemPathCandidates = [
            getenv('SystemRoot') ? rtrim((string) getenv('SystemRoot'), '\\/').DIRECTORY_SEPARATOR.'System32' : null,
            getenv('SystemRoot') ? (string) getenv('SystemRoot') : null,
            getenv('WINDIR') ? rtrim((string) getenv('WINDIR'), '\\/').DIRECTORY_SEPARATOR.'System32'.DIRECTORY_SEPARATOR.'Wbem' : null,
        ];

        foreach ($systemPathCandidates as $candidate) {
            if (is_string($candidate) && $candidate !== '' && is_dir($candidate)) {
                $pathSegments[] = $candidate;
            }
        }

        if ($pathSegments !== []) {
            $env['PATH'] = implode(PATH_SEPARATOR, array_values(array_unique($pathSegments)));
        }

        if (($systemRoot = getenv('SystemRoot')) !== false) {
            $env['SystemRoot'] = (string) $systemRoot;
        }
        if (($windir = getenv('WINDIR')) !== false) {
            $env['WINDIR'] = (string) $windir;
        }

        $homeDir = $this->resolveHomeDirectory($pythonExecutable);
        if ($homeDir !== '') {
            $env['HOME'] = $homeDir;
            $env['USERPROFILE'] = $homeDir;

            $drive = substr($homeDir, 0, 2);
            $homePath = substr($homeDir, 2);
            if ($drive !== '') {
                $env['HOMEDRIVE'] = $drive;
            }
            if ($homePath !== '') {
                $env['HOMEPATH'] = $homePath;
            }

            $appData = $homeDir.DIRECTORY_SEPARATOR.'AppData'.DIRECTORY_SEPARATOR.'Roaming';
            $localAppData = $homeDir.DIRECTORY_SEPARATOR.'AppData'.DIRECTORY_SEPARATOR.'Local';
            if (is_dir($appData)) {
                $env['APPDATA'] = $appData;
            }
            if (is_dir($localAppData)) {
                $env['LOCALAPPDATA'] = $localAppData;
            }
        }

        $username = $this->resolveUsername($homeDir);
        if ($username !== '') {
            $env['USERNAME'] = $username;
            $env['USER'] = $username;
            $env['LOGNAME'] = $username;
            $env['LNAME'] = $username;
        }

        $cacheBase = storage_path('app/ai-cache');
        $torchCache = $cacheBase.DIRECTORY_SEPARATOR.'torchinductor';
        $ultralyticsConfig = $cacheBase.DIRECTORY_SEPARATOR.'ultralytics';
        $this->ensureDirectory($torchCache);
        $this->ensureDirectory($ultralyticsConfig);
        $this->ensureDirectory($cacheBase.DIRECTORY_SEPARATOR.'tmp');

        $env['TORCHINDUCTOR_CACHE_DIR'] = $torchCache;
        $env['ULTRALYTICS_SETTINGS_DIR'] = $ultralyticsConfig;
        $env['TEMP'] = $cacheBase.DIRECTORY_SEPARATOR.'tmp';
        $env['TMP'] = $cacheBase.DIRECTORY_SEPARATOR.'tmp';
        $env['PYTORCH_NO_CUDA_MEMORY_CACHING'] = '1';
        $env['CUDA_VISIBLE_DEVICES'] = '';
        $env['TORCH_DISABLE_DYNAMO'] = '1';

        $env['PYTHONHOME'] = false;
        $env['PYTHONPATH'] = false;
        $env['PYTHONUTF8'] = '1';

        return $env;
    }

    private function resolveHomeDirectory(string $pythonExecutable): string
    {
        $userProfile = getenv('USERPROFILE');
        if (is_string($userProfile) && $userProfile !== '' && is_dir($userProfile)) {
            return $userProfile;
        }

        $home = getenv('HOME');
        if (is_string($home) && $home !== '' && is_dir($home)) {
            return $home;
        }

        foreach (['APPDATA', 'LOCALAPPDATA'] as $key) {
            $value = getenv($key);
            if (!is_string($value) || $value === '' || !is_dir($value)) {
                continue;
            }

            $candidate = dirname(dirname($value));
            if (is_dir($candidate)) {
                return $candidate;
            }
        }

        if ($pythonExecutable !== '') {
            $normalized = str_replace('/', '\\', $pythonExecutable);
            if (preg_match('/^[A-Za-z]:\\\\Users\\\\[^\\\\]+/', $normalized, $matches) === 1 && isset($matches[0])) {
                $candidate = $matches[0];
                if (is_dir($candidate)) {
                    return $candidate;
                }
            }
        }

        return '';
    }

    private function resolveUsername(string $homeDir): string
    {
        foreach (['USERNAME', 'USER', 'LOGNAME', 'LNAME'] as $key) {
            $value = getenv($key);
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        if ($homeDir !== '') {
            $parts = preg_split('/[\\\\\\/]+/', rtrim($homeDir, '\\/'));
            if (is_array($parts) && $parts !== []) {
                $candidate = trim((string) end($parts));
                if ($candidate !== '') {
                    return $candidate;
                }
            }
        }

        return '';
    }

    private function ensureDirectory(string $path): void
    {
        if ($path !== '' && !is_dir($path)) {
            @mkdir($path, 0777, true);
        }
    }

    private function windowsPythonExecutables(): array
    {
        if (DIRECTORY_SEPARATOR !== '\\') {
            return [];
        }

        $candidates = [];
        $roots = array_filter([
            getenv('LOCALAPPDATA') ? rtrim((string) getenv('LOCALAPPDATA'), '\\/').DIRECTORY_SEPARATOR.'Programs'.DIRECTORY_SEPARATOR.'Python' : null,
            'C:\\Python39',
            'C:\\Python310',
            'C:\\Python311',
            'C:\\Python312',
            'C:\\Python313',
            'C:\\Python314',
            'C:\\Program Files\\Python39',
            'C:\\Program Files\\Python310',
            'C:\\Program Files\\Python311',
            'C:\\Program Files\\Python312',
            'C:\\Program Files\\Python313',
            'C:\\Program Files\\Python314',
        ]);

        foreach ($roots as $root) {
            $direct = rtrim($root, '\\/').DIRECTORY_SEPARATOR.'python.exe';
            if (file_exists($direct)) {
                $candidates[] = $direct;
            }

            $pattern = rtrim($root, '\\/').DIRECTORY_SEPARATOR.'Python*'.DIRECTORY_SEPARATOR.'python.exe';
            $matches = glob($pattern) ?: [];
            foreach ($matches as $match) {
                if (file_exists($match)) {
                    $candidates[] = $match;
                }
            }
        }

        return array_values(array_unique($candidates));
    }

    private function buildDetectorWarning(array $meta): ?string
    {
        $messages = [];
        $variant = trim((string) ($meta['variantUsed'] ?? ''));
        $confUsed = $this->normalizeFloat($meta['confUsed'] ?? null, 0.25, 0.001, 0.99);
        $primaryConf = $this->normalizeFloat(config('services.ai_imaging.dental_disease_detection.conf', 0.25), 0.25, 0.001, 0.99);

        if ($variant !== '' && $variant !== 'original') {
            $messages[] = "Enhanced preprocessing was used ({$variant}) to improve detection.";
        }

        if ($confUsed < $primaryConf) {
            $messages[] = 'Fallback confidence threshold was used due to weak initial detections.';
        }

        return $messages !== [] ? implode(' ', $messages) : null;
    }

    private function normalizeFloat(mixed $value, float $default, float $min, float $max): float
    {
        $number = is_numeric($value) ? (float) $value : $default;
        return max($min, min($max, $number));
    }

    private function normalizeInt(mixed $value, int $default, int $min, int $max): int
    {
        $number = is_numeric($value) ? (int) $value : $default;
        return max($min, min($max, $number));
    }

    private function normalizeBool(mixed $value): bool
    {
        return filter_var($value, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) ?? false;
    }
}
