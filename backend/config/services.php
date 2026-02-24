<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'openai' => [
        'api_key' => env('OPENAI_API_KEY', ''),
        'model' => env('OPENAI_MODEL', 'gpt-4.1-mini'),
        'verify_ssl' => filter_var(env('OPENAI_VERIFY_SSL', true), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) ?? true,
        'ca_bundle' => env('OPENAI_CA_BUNDLE', ''),
    ],

    'ai_imaging' => [
        'provider' => env('AI_IMAGING_PROVIDER', 'dental_disease_detection'),
        'timeout' => (int) env('AI_IMAGING_TIMEOUT', 120),
        'dental_disease_detection' => [
            'python_bin' => env('DENTAL_DISEASE_DETECTION_PYTHON', 'python'),
            'repo_path' => env('DENTAL_DISEASE_DETECTION_REPO_PATH', base_path('../third_party/Dental_Disease_Detection/project-main')),
            'script_path' => env('DENTAL_DISEASE_DETECTION_SCRIPT_PATH', base_path('scripts/dental_disease_detection_detect.py')),
            'model_path' => env('DENTAL_DISEASE_DETECTION_MODEL_PATH', base_path('../third_party/Dental_Disease_Detection/project-main/model/runs/detect/Yolo_10s_train/weights/best.pt')),
            'conf' => (float) env('DENTAL_DISEASE_DETECTION_CONF', 0.25),
            'fallback_conf' => (float) env('DENTAL_DISEASE_DETECTION_FALLBACK_CONF', 0.1),
            'iou' => (float) env('DENTAL_DISEASE_DETECTION_IOU', 0.45),
            'imgsz' => (int) env('DENTAL_DISEASE_DETECTION_IMGSZ', 1280),
            'augment' => filter_var(env('DENTAL_DISEASE_DETECTION_AUGMENT', false), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) ?? false,
            'multi_pass' => filter_var(env('DENTAL_DISEASE_DETECTION_MULTI_PASS', true), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) ?? true,
        ],
    ],

];
