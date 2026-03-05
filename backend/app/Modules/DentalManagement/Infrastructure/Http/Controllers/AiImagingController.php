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
        $timeout = (int) config('services.ai_imaging.timeout', 120);
        $provider = strtolower(trim((string) config('services.ai_imaging.provider', 'gemini')));

        if ($provider === 'gemini') {
            [$responseData, $errorMessage] = $this->runGeminiVision(
                $imagePath,
                $timeout,
                $mimeType,
                $modality,
                $patientContext
            );

            if ($errorMessage !== null) {
                if ($this->isGeminiQuotaOrRateLimitError($errorMessage)) {
                    [$fallbackDetections, $fallbackError, $fallbackModelName, $fallbackMeta] = $this->runDentalDiseaseDetector(
                        $imagePath,
                        $timeout
                    );

                    if ($fallbackError === null) {
                        $fallbackReport = $this->buildDetectionOnlyReport($fallbackDetections);
                        $warningParts = array_filter([
                            'Gemini quota exceeded; dental detector fallback was used.',
                            $this->buildDetectorWarning($fallbackMeta),
                        ], static fn ($item): bool => is_string($item) && trim($item) !== '');

                        return $this->successResponse(
                            data: [
                                'detections' => $fallbackDetections,
                                'detectorModel' => $fallbackModelName,
                                'detectorMeta' => $fallbackMeta,
                                'detectorWarning' => implode(' ', $warningParts),
                                'disclaimer' => 'Detection output from Dental Disease Detection fallback. Clinical interpretation required.',
                                'model' => $fallbackModelName,
                                'modality' => $modality,
                                'provider' => 'dental_disease_detection_fallback',
                                'rawText' => json_encode(['detections' => $fallbackDetections], JSON_UNESCAPED_UNICODE) ?: '',
                                'report' => $fallbackReport,
                            ],
                            message: 'Gemini quota exceeded; dental disease detector fallback completed.'
                        );
                    }
                }

                return $this->errorResponse(
                    code: 'AI_ANALYSIS_FAILED',
                    message: 'Gemini analysis failed.',
                    details: $errorMessage,
                    httpCode: 500
                );
            }

            return $this->successResponse(
                data: $responseData,
                message: 'Gemini analysis completed.'
            );
        }

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

    private function runGeminiVision(
        string $imagePath,
        int $timeout,
        string $mimeType,
        string $modality,
        string $patientContext
    ): array {
        $apiKey = trim((string) config('services.ai_imaging.gemini.api_key', ''));
        $model = trim((string) config('services.ai_imaging.gemini.model', 'gemini-2.0-flash'));
        $endpoint = rtrim((string) config('services.ai_imaging.gemini.endpoint', 'https://generativelanguage.googleapis.com/v1beta'), '/');
        $verifySsl = $this->normalizeBool(config('services.ai_imaging.gemini.verify_ssl', true));
        $caBundle = trim((string) config('services.ai_imaging.gemini.ca_bundle', ''));

        if ($apiKey === '') {
            return [[], 'Gemini API key is not configured. Set GEMINI_API_KEY in backend .env.'];
        }
        if ($model === '') {
            return [[], 'Gemini model is not configured. Set GEMINI_MODEL in backend .env.'];
        }
        if ($endpoint === '') {
            return [[], 'Gemini endpoint is not configured. Set GEMINI_ENDPOINT in backend .env.'];
        }
        if (!file_exists($imagePath)) {
            return [[], 'Uploaded image file is not available for Gemini processing.'];
        }

        $imageBytes = @file_get_contents($imagePath);
        if ($imageBytes === false) {
            return [[], 'Failed to read uploaded image bytes for Gemini processing.'];
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

        $modelPath = str_starts_with($model, 'models/') ? $model : "models/{$model}";
        $url = "{$endpoint}/{$modelPath}:generateContent?key=".urlencode($apiKey);

        $contextText = trim($patientContext);
        $prompt = <<<PROMPT
You are a dental imaging assistant.
Analyze the provided dental image and return only valid JSON with this exact structure:
{
  "summary": "short summary",
  "findings": ["..."],
  "concerns": ["..."],
  "recommendations": ["..."],
  "urgency": "low|moderate|high",
  "confidence": 0,
  "disclaimer": "short disclaimer",
  "detections": [
    { "label": "name", "confidence": 0.0, "x1": 0, "y1": 0, "x2": 0, "y2": 0 }
  ]
}
Rules:
- confidence must be integer 0..100
- detections confidence must be 0..1
- if no reliable boxes exist, return "detections": []
- keep findings and recommendations concise and clinically cautious
- this is advisory output, not a diagnosis
Modality: {$modality}
Clinical context: {$contextText}
PROMPT;

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
                    'maxOutputTokens' => 1400,
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
            $promptFeedback = is_array($decoded['promptFeedback'] ?? null) ? $decoded['promptFeedback'] : [];
            $blockReason = trim((string) ($promptFeedback['blockReason'] ?? ''));
            $message = $blockReason !== ''
                ? "Gemini returned no text. Block reason: {$blockReason}."
                : 'Gemini returned no text output.';
            return [[], $message];
        }

        $parsed = $this->extractGeminiJsonObject($rawText);
        $report = $this->buildGeminiReport($parsed, $rawText, $modality);
        $detections = $this->normalizeGeminiDetections($parsed['detections'] ?? null);

        $warnings = [];
        if ($parsed === null) {
            $warnings[] = 'Gemini returned unstructured output; fallback parsing was used.';
        }

        return [[
            'detections' => $detections,
            'disclaimer' => $report['disclaimer'],
            'model' => $model,
            'modality' => $modality,
            'provider' => 'gemini',
            'rawText' => $rawText,
            'report' => $report,
            'detectorWarning' => $warnings !== [] ? implode(' ', $warnings) : null,
        ], null];
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

    private function extractGeminiJsonObject(string $text): ?array
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

    private function buildGeminiReport(?array $parsed, string $rawText, string $modality): array
    {
        $defaultDisclaimer = 'AI-generated interpretation from Gemini. Clinical confirmation is required.';

        if ($parsed === null) {
            $summary = $this->truncateText(trim(preg_replace('/\s+/', ' ', $rawText) ?? $rawText), 280);
            return [
                'confidence' => 60,
                'concerns' => ['Model returned unstructured output; result was interpreted conservatively.'],
                'disclaimer' => $defaultDisclaimer,
                'findings' => [$summary !== '' ? $summary : 'No structured findings were returned.'],
                'recommendations' => [
                    'Correlate this output with clinical examination and radiographic review.',
                    'Do not use this output as a standalone diagnosis.',
                ],
                'summary' => $summary !== '' ? $summary : "Gemini provided analysis text for modality {$modality}.",
                'urgency' => 'moderate',
            ];
        }

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
            $summary = $findings[0] ?? "Gemini provided analysis for {$modality}.";
        }
        if ($findings === []) {
            $findings = ['No structured findings returned by Gemini.'];
        }
        if ($recommendations === []) {
            $recommendations = [
                'Correlate with clinical exam before treatment decisions.',
                'Use this as decision support only.',
            ];
        }
        if ($disclaimer === '') {
            $disclaimer = $defaultDisclaimer;
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
            if (count($normalized) >= 12) {
                break;
            }
        }

        return array_values(array_unique($normalized));
    }

    private function normalizeGeminiDetections(mixed $value): array
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

            $confidence = (float) ($item['confidence'] ?? 0);
            if ($confidence > 1 && $confidence <= 100) {
                $confidence /= 100;
            }
            $confidence = max(0, min(1, $confidence));

            $x1 = (int) ($item['x1'] ?? 0);
            $y1 = (int) ($item['y1'] ?? 0);
            $x2 = (int) ($item['x2'] ?? 0);
            $y2 = (int) ($item['y2'] ?? 0);

            if ($x2 <= $x1 || $y2 <= $y1) {
                continue;
            }

            $normalized[] = [
                'confidence' => $confidence,
                'label' => $label,
                'x1' => $x1,
                'x2' => $x2,
                'y1' => $y1,
                'y2' => $y2,
            ];

            if (count($normalized) >= 50) {
                break;
            }
        }

        return $normalized;
    }

    private function isGeminiQuotaOrRateLimitError(string $message): bool
    {
        $normalized = strtolower($message);

        return str_contains($normalized, 'http 429')
            || str_contains($normalized, 'quota')
            || str_contains($normalized, 'rate limit')
            || str_contains($normalized, 'resource_exhausted');
    }

    private function runOcrSpace(string $imagePath, int $timeout, string $uploadFilename): array
    {
        $endpoint = trim((string) config('services.ai_imaging.ocr_space.endpoint', 'https://api.ocr.space/parse/image'));
        $apiKey = trim((string) config('services.ai_imaging.ocr_space.api_key', ''));
        $language = trim((string) config('services.ai_imaging.ocr_space.language', 'eng'));
        $engine = $this->normalizeInt(config('services.ai_imaging.ocr_space.engine', 2), 2, 1, 2);
        $overlay = $this->normalizeBool(config('services.ai_imaging.ocr_space.overlay', true));
        $verifySsl = $this->normalizeBool(config('services.ai_imaging.ocr_space.verify_ssl', true));
        $caBundle = trim((string) config('services.ai_imaging.ocr_space.ca_bundle', ''));

        if ($endpoint === '') {
            return ['', [], 'OCR endpoint is not configured.', 'ocr.space-engine-'.$engine, null];
        }

        if (!file_exists($imagePath)) {
            return ['', [], 'Uploaded image file is not available for OCR processing.', 'ocr.space-engine-'.$engine, null];
        }

        $fileContents = @file_get_contents($imagePath);
        if ($fileContents === false) {
            return ['', [], 'Failed to read uploaded image bytes for OCR processing.', 'ocr.space-engine-'.$engine, null];
        }

        $request = Http::timeout(max(10, $timeout))->acceptJson();
        if (!$verifySsl) {
            $request = $request->withoutVerifying();
        } elseif ($caBundle !== '') {
            if (!file_exists($caBundle)) {
                return [
                    '',
                    [],
                    'OCR CA bundle file not found at: '.$caBundle,
                    'ocr.space-engine-'.$engine,
                    null,
                ];
            }
            $request = $request->withOptions(['verify' => $caBundle]);
        }

        if ($apiKey !== '') {
            $request = $request->withHeaders(['apikey' => $apiKey]);
        }

        try {
            $response = $request
                ->attach('file', $fileContents, $uploadFilename)
                ->post($endpoint, [
                    'language' => $language !== '' ? $language : 'eng',
                    'isOverlayRequired' => $overlay ? 'true' : 'false',
                    'OCREngine' => (string) $engine,
                    'detectOrientation' => 'true',
                    'scale' => 'true',
                    'isCreateSearchablePdf' => 'false',
                ]);
        } catch (\Throwable $exception) {
            return ['', [], 'OCR request failed: '.$exception->getMessage(), 'ocr.space-engine-'.$engine, null];
        }

        if (!$response->successful()) {
            return [
                '',
                [],
                'OCR service returned HTTP '.$response->status().'. '.$this->truncateText((string) $response->body(), 300),
                'ocr.space-engine-'.$engine,
                null,
            ];
        }

        $decoded = $response->json();
        if (!is_array($decoded)) {
            return ['', [], 'OCR service returned invalid JSON.', 'ocr.space-engine-'.$engine, null];
        }

        $isErrored = $this->normalizeBool($decoded['IsErroredOnProcessing'] ?? false);
        $ocrExitCode = (int) ($decoded['OCRExitCode'] ?? 0);

        if ($isErrored || $ocrExitCode !== 1) {
            return [
                '',
                [],
                $this->extractOcrError($decoded) ?: 'OCR service failed to extract text.',
                'ocr.space-engine-'.$engine,
                null,
            ];
        }

        $parsedResults = is_array($decoded['ParsedResults'] ?? null) ? $decoded['ParsedResults'] : [];
        $textChunks = [];
        $detections = [];

        foreach ($parsedResults as $result) {
            if (!is_array($result)) {
                continue;
            }

            $parsedText = trim((string) ($result['ParsedText'] ?? ''));
            if ($parsedText !== '') {
                $textChunks[] = $parsedText;
            }

            $overlayLines = $result['TextOverlay']['Lines'] ?? [];
            if (!$overlay || !is_array($overlayLines)) {
                continue;
            }

            foreach ($overlayLines as $line) {
                if (!is_array($line)) {
                    continue;
                }

                $words = is_array($line['Words'] ?? null) ? $line['Words'] : [];
                if ($words === []) {
                    continue;
                }

                $lefts = [];
                $tops = [];
                $rights = [];
                $bottoms = [];
                foreach ($words as $word) {
                    if (!is_array($word)) {
                        continue;
                    }
                    $left = (int) ($word['Left'] ?? 0);
                    $top = (int) ($word['Top'] ?? 0);
                    $width = (int) ($word['Width'] ?? 0);
                    $height = (int) ($word['Height'] ?? 0);
                    if ($width <= 0 || $height <= 0) {
                        continue;
                    }

                    $lefts[] = $left;
                    $tops[] = $top;
                    $rights[] = $left + $width;
                    $bottoms[] = $top + $height;
                }

                if ($lefts === [] || $tops === [] || $rights === [] || $bottoms === []) {
                    continue;
                }

                $detections[] = [
                    'confidence' => 0.7,
                    'label' => 'text',
                    'x1' => min($lefts),
                    'x2' => max($rights),
                    'y1' => min($tops),
                    'y2' => max($bottoms),
                ];

                if (count($detections) >= 60) {
                    break 2;
                }
            }
        }

        $rawText = trim(implode("\n", $textChunks));
        $warning = (strtolower($apiKey) === 'helloworld' || $apiKey === '')
            ? 'Using OCR.Space demo key. Expect strict rate limits and reduced reliability.'
            : null;

        return [$rawText, $detections, null, 'ocr.space-engine-'.$engine, $warning];
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

    private function buildOcrOnlyReport(string $rawText): array
    {
        $text = trim($rawText);
        if ($text === '') {
            return [
                'confidence' => 0,
                'concerns' => ['No readable text was detected in the uploaded image.'],
                'disclaimer' => 'OCR-only output. Clinical interpretation required.',
                'findings' => ['No text was extracted from the image.'],
                'recommendations' => [
                    'Try a clearer image with higher contrast and focus.',
                    'Retake image in better lighting and avoid blur or glare.',
                    'Use manual review for any clinical decision.',
                ],
                'summary' => 'OCR could not detect readable text from the uploaded image.',
                'urgency' => 'low',
            ];
        }

        $normalized = preg_replace('/\s+/', ' ', $text) ?? $text;
        $sample = $this->truncateText($normalized, 220);
        $wordCount = count(array_filter(preg_split('/\s+/', $normalized) ?: [], static fn ($word): bool => $word !== ''));
        $lineCount = count(array_filter(preg_split('/\r\n|\r|\n/', $rawText) ?: [], static fn ($line): bool => trim($line) !== ''));
        $confidence = min(95, max(45, 55 + (int) floor($wordCount / 8)));

        return [
            'confidence' => $confidence,
            'concerns' => [
                'OCR text may contain recognition errors, especially with low-quality images.',
            ],
            'disclaimer' => 'OCR-only output. Clinical interpretation required.',
            'findings' => [
                "Extracted approximately {$wordCount} word(s) across {$lineCount} line(s).",
                "Sample text: {$sample}",
            ],
            'recommendations' => [
                'Manually verify extracted text before using it in records.',
                'If critical text is missing, upload a sharper image and rerun OCR.',
                'Use extracted text as reference only, not as a final diagnosis.',
            ],
            'summary' => 'OCR text extraction completed successfully.',
            'urgency' => 'low',
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

    private function resolveUploadFilename(string $originalName, string $originalExtension): string
    {
        $allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'bmp', 'gif', 'tif', 'tiff', 'webp'];
        $name = trim(basename($originalName));
        $extension = strtolower(trim($originalExtension));

        if ($extension === '' && $name !== '') {
            $fromName = strtolower(trim((string) pathinfo($name, PATHINFO_EXTENSION)));
            if ($fromName !== '') {
                $extension = $fromName;
            }
        }

        if (!in_array($extension, $allowedExtensions, true)) {
            $extension = 'jpg';
        }

        if ($name === '') {
            return 'upload.'.$extension;
        }

        $nameWithoutExtension = trim((string) pathinfo($name, PATHINFO_FILENAME));
        if ($nameWithoutExtension === '') {
            $nameWithoutExtension = 'upload';
        }

        return $nameWithoutExtension.'.'.$extension;
    }

    private function truncateText(string $value, int $maxLength): string
    {
        if (mb_strlen($value) <= $maxLength) {
            return $value;
        }

        return rtrim(mb_substr($value, 0, max(1, $maxLength - 3))).'...';
    }

    private function extractOcrError(array $payload): string
    {
        $errors = [];

        $rootMessage = $payload['ErrorMessage'] ?? null;
        if (is_string($rootMessage) && trim($rootMessage) !== '') {
            $errors[] = trim($rootMessage);
        } elseif (is_array($rootMessage)) {
            foreach ($rootMessage as $item) {
                if (is_string($item) && trim($item) !== '') {
                    $errors[] = trim($item);
                }
            }
        }

        $rootDetails = $payload['ErrorDetails'] ?? null;
        if (is_string($rootDetails) && trim($rootDetails) !== '') {
            $errors[] = trim($rootDetails);
        }

        $parsedResults = is_array($payload['ParsedResults'] ?? null) ? $payload['ParsedResults'] : [];
        foreach ($parsedResults as $result) {
            if (!is_array($result)) {
                continue;
            }

            $message = $result['ErrorMessage'] ?? null;
            if (is_string($message) && trim($message) !== '') {
                $errors[] = trim($message);
            } elseif (is_array($message)) {
                foreach ($message as $item) {
                    if (is_string($item) && trim($item) !== '') {
                        $errors[] = trim($item);
                    }
                }
            }

            $details = $result['ErrorDetails'] ?? null;
            if (is_string($details) && trim($details) !== '') {
                $errors[] = trim($details);
            }
        }

        $errors = array_values(array_unique(array_filter($errors, static fn ($item): bool => $item !== '')));
        return implode(' ', $errors);
    }
}
