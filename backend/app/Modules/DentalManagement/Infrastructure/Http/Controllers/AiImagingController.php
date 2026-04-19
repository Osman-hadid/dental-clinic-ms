<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\AiImaging\AnalyzeDentalImageRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
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
        $patientContext = (string) ($request->validated('patientContext') ?? '');
        $imagePath = (string) $file->getRealPath();
        $mimeType = (string) ($file->getMimeType() ?: 'image/jpeg');
        $timeout = (int) config('services.ai_imaging.timeout', 180);
        $provider = strtolower(trim((string) config('services.ai_imaging.provider', 'dentalgemma')));

        if (in_array($provider, ['dentalgemma', 'dental_gemma', 'dentalgemma_local'], true)) {
            [$responseData, $errorMessage] = $this->runDentalGemmaFlow(
                $imagePath,
                $timeout,
                $mimeType,
                $modality,
                $patientContext
            );

            if ($errorMessage !== null) {
                return $this->errorResponse(
                    code: 'AI_ANALYSIS_FAILED',
                    message: 'DentalGemma analysis failed.',
                    details: $errorMessage,
                    httpCode: 500
                );
            }

            return $this->successResponse(
                data: $responseData,
                message: 'DentalGemma analysis completed.'
            );
        }

        [$responseData, $errorMessage] = $this->runGeminiVision(
            $imagePath,
            $timeout,
            $mimeType,
            $modality,
            $patientContext
        );

        if ($errorMessage !== null) {
            return $this->errorResponse(
                code: 'AI_ANALYSIS_FAILED',
                message: 'AI imaging analysis failed.',
                details: $errorMessage,
                httpCode: 500
            );
        }

        return $this->successResponse(
            data: $responseData,
            message: 'AI imaging analysis completed.'
        );
    }

    private function runDentalGemmaFlow(
        string $imagePath,
        int $timeout,
        string $mimeType,
        string $modality,
        string $patientContext
    ): array {
        [$localResult, $localError] = $this->runDentalGemmaLocal($imagePath, $timeout, $modality, $patientContext);
        if ($localError === null) {
            return [$localResult, null];
        }

        [$geminiResult, $geminiError] = $this->runGeminiVision(
            $imagePath,
            $timeout,
            $mimeType,
            $modality,
            $patientContext,
            true
        );

        if ($geminiError !== null) {
            return [[], 'DentalGemma local runner was unavailable ('.$localError.') and Gemini fallback also failed: '.$geminiError];
        }

        $geminiResult['provider'] = 'dentalgemma_gemini_fallback';
        $geminiResult['model'] = trim((string) config('services.ai_imaging.dentalgemma.model_name', 'DentalGemma 1.5 4B IT')).' via Gemini fallback';
        $warning = 'Local DentalGemma model was not available on this machine, so a Gemini report fallback was used instead.';
        $existing = trim((string) ($geminiResult['analysisWarning'] ?? ''));
        $geminiResult['analysisWarning'] = trim($warning.' '.$existing);

        return [$geminiResult, null];
    }

    private function runDentalGemmaLocal(string $imagePath, int $timeout, string $modality, string $patientContext): array
    {
        $repoPath = trim((string) config('services.ai_imaging.dentalgemma.repo_path', base_path()));
        $scriptPath = trim((string) config('services.ai_imaging.dentalgemma.script_path', ''));
        $modelPath = trim((string) config('services.ai_imaging.dentalgemma.model_path', ''));
        $pythonCommand = $this->resolvePythonCommand(
            trim((string) config('services.ai_imaging.dentalgemma.python_bin', 'python'))
        );
        $modelName = trim((string) config('services.ai_imaging.dentalgemma.model_name', 'DentalGemma 1.5 4B IT'));

        if ($scriptPath === '' || !file_exists($scriptPath)) {
            return [[], 'DentalGemma runner script is not configured.'];
        }

        if ($modelPath === '' || !is_dir($modelPath)) {
            return [[], 'DentalGemma model files are not present locally. Download the full model repository first.'];
        }

        if ($repoPath === '' || !is_dir($repoPath)) {
            $repoPath = base_path();
        }

        $process = new Process(
            [
                ...$pythonCommand,
                $scriptPath,
                '--image',
                $imagePath,
                '--model-dir',
                $modelPath,
                '--modality',
                $modality,
                '--context',
                $patientContext,
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
            return [[], $message];
        }

        $decoded = json_decode(trim($process->getOutput()), true);
        if (!is_array($decoded)) {
            return [[], 'DentalGemma runner returned invalid JSON output.'];
        }

        $rawText = trim((string) ($decoded['rawText'] ?? ''));
        $parsedReport = is_array($decoded['report'] ?? null)
            ? $this->normalizeStructuredReport($decoded['report'])
            : $this->buildNarrativeReportFromText($rawText, $modality);

        return [[
            'analysisWarning' => trim((string) ($decoded['analysisWarning'] ?? '')) ?: null,
            'disclaimer' => $parsedReport['disclaimer'],
            'model' => $modelName,
            'modality' => $modality,
            'provider' => 'dentalgemma_local',
            'rawText' => $rawText,
            'report' => $parsedReport,
        ], null];
    }

    private function runGeminiVision(
        string $imagePath,
        int $timeout,
        string $mimeType,
        string $modality,
        string $patientContext,
        bool $reportOnly = false
    ): array {
        $apiKey = trim((string) config('services.ai_imaging.gemini.api_key', ''));
        $model = trim((string) config('services.ai_imaging.gemini.model', 'gemini-2.0-flash'));
        $endpoint = rtrim((string) config('services.ai_imaging.gemini.endpoint', 'https://generativelanguage.googleapis.com/v1beta'), '/');
        $verifySsl = $this->normalizeBool(config('services.ai_imaging.gemini.verify_ssl', true));
        $caBundle = trim((string) config('services.ai_imaging.gemini.ca_bundle', ''));

        if ($apiKey === '') {
            return [[], 'Gemini API key is not configured.'];
        }
        if ($model === '' || $endpoint === '') {
            return [[], 'Gemini model settings are incomplete.'];
        }

        $imageBytes = @file_get_contents($imagePath);
        if ($imageBytes === false) {
            return [[], 'Failed to read uploaded image bytes.'];
        }

        $request = Http::timeout(max(10, $timeout))->acceptJson();
        if (!$verifySsl) {
            $request = $request->withoutVerifying();
        } elseif ($caBundle !== '') {
            if (!file_exists($caBundle)) {
                return [[], 'Gemini CA bundle file not found at: '.$caBundle];
            }
            $request = $request->withOptions(['verify' => $caBundle]);
        }

        $prompt = $this->buildGeminiPrompt($modality, $patientContext, $reportOnly);
        $modelPath = str_starts_with($model, 'models/') ? $model : "models/{$model}";
        $url = "{$endpoint}/{$modelPath}:generateContent?key=".urlencode($apiKey);

        try {
            $response = $request->post($url, [
                'contents' => [[
                    'role' => 'user',
                    'parts' => [
                        ['text' => $prompt],
                        [
                            'inline_data' => [
                                'mime_type' => $mimeType !== '' ? $mimeType : 'image/jpeg',
                                'data' => base64_encode($imageBytes),
                            ],
                        ],
                    ],
                ]],
                'generationConfig' => [
                    'temperature' => 0.2,
                    'maxOutputTokens' => 1200,
                ],
            ]);
        } catch (\Throwable $exception) {
            return [[], 'Gemini request failed: '.$exception->getMessage()];
        }

        if (!$response->successful()) {
            return [[], 'Gemini service returned HTTP '.$response->status().'. '.$this->truncateText((string) $response->body(), 400)];
        }

        $decoded = $response->json();
        if (!is_array($decoded)) {
            return [[], 'Gemini service returned invalid JSON.'];
        }

        $rawText = $this->extractGeminiText($decoded);
        if (trim($rawText) === '') {
            return [[], 'Gemini returned no text output.'];
        }

        $parsed = $this->extractJsonObject($rawText);
        $report = is_array($parsed) ? $this->normalizeStructuredReport($parsed) : $this->buildNarrativeReportFromText($rawText, $modality);

        return [[
            'analysisWarning' => is_array($parsed) ? null : 'The model returned free text, so the report was structured conservatively.',
            'disclaimer' => $report['disclaimer'],
            'model' => $model,
            'modality' => $modality,
            'provider' => 'gemini',
            'rawText' => $rawText,
            'report' => $report,
        ], null];
    }

    private function buildGeminiPrompt(string $modality, string $patientContext, bool $reportOnly): string
    {
        $contextText = trim($patientContext) !== '' ? trim($patientContext) : 'No extra clinical context provided.';
        $modeText = $reportOnly
            ? 'Produce a human-friendly dental radiology style report only.'
            : 'Produce a human-friendly dental radiology style report.';

        return <<<PROMPT
You are a dental radiology assistant.
{$modeText}
Analyze the provided dental image and return only valid JSON with this structure:
{
  "summary": "plain-language overall impression",
  "findings": ["short bullet", "..."],
  "concerns": ["short concern", "..."],
  "recommendations": ["practical next step", "..."],
  "urgency": "low|moderate|high",
  "confidence": 0,
  "disclaimer": "short disclaimer"
}
Rules:
- Write for a dentist or clinic user, not for a machine learning engineer.
- Do not include detection boxes, masks, or coordinates.
- Keep findings and recommendations concise, clinically cautious, and easy to understand.
- Confidence must be an integer from 0 to 100.
Modality: {$modality}
Clinical context: {$contextText}
PROMPT;
    }

    private function extractGeminiText(array $payload): string
    {
        $chunks = [];
        $candidates = is_array($payload['candidates'] ?? null) ? $payload['candidates'] : [];
        foreach ($candidates as $candidate) {
            if (!is_array($candidate)) {
                continue;
            }

            $parts = $candidate['content']['parts'] ?? [];
            if (!is_array($parts)) {
                continue;
            }

            foreach ($parts as $part) {
                if (is_array($part) && is_string($part['text'] ?? null) && trim($part['text']) !== '') {
                    $chunks[] = trim($part['text']);
                }
            }
        }

        return trim(implode("\n", $chunks));
    }

    private function extractJsonObject(string $text): ?array
    {
        $trimmed = trim($text);
        if ($trimmed !== '') {
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        if (preg_match('/```json\s*(\{[\s\S]*?\})\s*```/i', $text, $matches) === 1) {
            $decoded = json_decode(trim((string) ($matches[1] ?? '')), true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        if (preg_match('/\{[\s\S]*\}/', $text, $matches) === 1) {
            $decoded = json_decode(trim((string) ($matches[0] ?? '')), true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return null;
    }

    private function normalizeStructuredReport(array $parsed): array
    {
        $summary = trim((string) ($parsed['summary'] ?? ''));
        $findings = $this->normalizeStringList($parsed['findings'] ?? []);
        $concerns = $this->normalizeStringList($parsed['concerns'] ?? []);
        $recommendations = $this->normalizeStringList($parsed['recommendations'] ?? []);
        $urgency = strtolower(trim((string) ($parsed['urgency'] ?? 'moderate')));
        $disclaimer = trim((string) ($parsed['disclaimer'] ?? ''));
        $confidence = $this->normalizeInt($parsed['confidence'] ?? 60, 60, 0, 100);

        if (!in_array($urgency, ['low', 'moderate', 'high'], true)) {
            $urgency = 'moderate';
        }
        if ($summary === '') {
            $summary = $findings[0] ?? 'The model produced a dental imaging report.';
        }
        if ($findings === []) {
            $findings = ['No clear structured findings were returned by the model.'];
        }
        if ($recommendations === []) {
            $recommendations = [
                'Correlate the AI output with clinical examination before treatment decisions.',
                'Use the AI result as decision support rather than as a final diagnosis.',
            ];
        }
        if ($disclaimer === '') {
            $disclaimer = 'AI-generated dental imaging interpretation. Clinical confirmation is required.';
        }

        return [
            'confidence' => $confidence,
            'concerns' => $concerns,
            'disclaimer' => $disclaimer,
            'findings' => $findings,
            'recommendations' => $recommendations,
            'summary' => $summary,
            'urgency' => $urgency,
        ];
    }

    private function buildNarrativeReportFromText(string $rawText, string $modality): array
    {
        $summary = $this->truncateText(trim((string) preg_replace('/\s+/', ' ', $rawText)), 280);

        return [
            'confidence' => 55,
            'concerns' => ['The model returned free text rather than a fully structured report.'],
            'disclaimer' => 'AI-generated dental imaging interpretation. Clinical confirmation is required.',
            'findings' => [$summary !== '' ? $summary : "The model produced narrative output for {$modality}."],
            'recommendations' => [
                'Review this output together with the image before charting or treatment planning.',
                'Use the report as decision support only, not as a final diagnosis.',
            ],
            'summary' => $summary !== '' ? $summary : "The model produced narrative output for {$modality}.",
            'urgency' => 'moderate',
        ];
    }

    private function normalizeStringList(mixed $value): array
    {
        if (is_string($value)) {
            $value = preg_split('/\r\n|\r|\n|;/', $value) ?: [];
        }
        if (!is_array($value)) {
            return [];
        }

        $normalized = [];
        foreach ($value as $item) {
            $text = trim((string) $item);
            if ($text === '') {
                continue;
            }

            $normalized[] = $text;
            if (count($normalized) >= 10) {
                break;
            }
        }

        return array_values(array_unique($normalized));
    }

    private function resolvePythonCommand(string $configuredOverride = ''): array
    {
        $configured = trim($configuredOverride !== '' ? $configuredOverride : 'python');
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

        if ($pathSegments !== []) {
            $env['PATH'] = implode(PATH_SEPARATOR, array_values(array_unique($pathSegments)));
        }

        $cacheBase = storage_path('app/ai-cache');
        $tmpDir = $cacheBase.DIRECTORY_SEPARATOR.'tmp';
        $this->ensureDirectory($tmpDir);
        $env['TEMP'] = $tmpDir;
        $env['TMP'] = $tmpDir;
        $env['CUDA_VISIBLE_DEVICES'] = '';
        $env['PYTHONUTF8'] = '1';
        $env['PYTHONHOME'] = false;
        $env['PYTHONPATH'] = false;

        return $env;
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
            'C:\\Program Files\\Python39',
            'C:\\Program Files\\Python310',
            'C:\\Program Files\\Python311',
            'C:\\Program Files\\Python312',
        ]);

        foreach ($roots as $root) {
            $direct = rtrim($root, '\\/').DIRECTORY_SEPARATOR.'python.exe';
            if (file_exists($direct)) {
                $candidates[] = $direct;
            }

            $matches = glob(rtrim($root, '\\/').DIRECTORY_SEPARATOR.'Python*'.DIRECTORY_SEPARATOR.'python.exe') ?: [];
            foreach ($matches as $match) {
                if (file_exists($match)) {
                    $candidates[] = $match;
                }
            }
        }

        return array_values(array_unique($candidates));
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

    private function truncateText(string $value, int $maxLength): string
    {
        if (mb_strlen($value) <= $maxLength) {
            return $value;
        }

        return rtrim(mb_substr($value, 0, max(1, $maxLength - 3))).'...';
    }
}
