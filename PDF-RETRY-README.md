# PDF Generation Retry Functionality

## Overview

This document explains the PDF generation retry functionality that has been implemented in the TRA Receipt Management System. The system now includes both automatic and manual retry mechanisms for failed PDF generation jobs.

## Features

### 1. Automatic Retry in Worker Process

The PDF worker process now includes automatic retry functionality:

- When a PDF generation job fails, the system will automatically retry up to 3 times with exponential backoff (1s, 2s, 4s delays between retries).
- The worker also periodically checks for receipts with 'failed' status that haven't been retried recently (older than 30 minutes) and automatically re-queues them for processing.

### 2. Manual Retry via API Endpoints

Two new API endpoints have been added to allow users to manually trigger retries:

- **Retry a single receipt**: `POST /receipts/:id/retry-pdf`
- **Retry all failed receipts**: `POST /receipts/mine/retry-all-pdfs`

Both endpoints require authentication and will only retry receipts that belong to the authenticated user.

## Status Tracking

The system now uses the following status values for PDF generation:

- `pending`: Initial state when a receipt is created and queued for PDF generation
- `processing`: The worker is actively generating the PDF
- `retry_pending`: The job has failed and is scheduled for retry
- `done`: PDF generation completed successfully
- `failed`: PDF generation failed after all retry attempts

## How to Use

### Manual Retry for a Single Receipt

```http
POST /receipts/123/retry-pdf
Authorization: Bearer YOUR_JWT_TOKEN
```

Response:
```json
{
  "status": "queued",
  "receiptId": 123
}
```

### Manual Retry for All Failed Receipts

```http
POST /receipts/mine/retry-all-pdfs
Authorization: Bearer YOUR_JWT_TOKEN
```

Response:
```json
{
  "status": "success",
  "message": "Queued 5 receipts for PDF generation retry. Failed to queue 0 receipts.",
  "count": 5
}
```

## Testing

A test script has been provided to verify the retry functionality:

```bash
node src/test-pdf-retry.js
```

This script simulates a PDF generation failure on the first attempt and then a successful generation on the retry.

## Verification Code Handling

The system now handles cases where verification codes are missing or not generated:

- If a verification code is available, it will be displayed in the PDF and used to generate a QR code with the URL `https://verify.tra.go.tz/{verificationCode}`
- If no verification code is available, the PDF will display "VERIFICATION CODE NOT AVAILABLE" and the QR code will point to the base URL `https://verify.tra.go.tz/`
- The system prioritizes using `verificationCodeUrl` or `verificationUrl` if available, falling back to constructing the URL from the verification code

## Troubleshooting

If you encounter issues with the PDF generation retry functionality:

1. Check the worker logs for error messages
2. Verify that the receipt status is correctly set in the database
3. Ensure that the verification code URL is properly set in the receipt data (or handled appropriately if missing)
4. Check that the worker process is running and able to connect to the database and Redis

## Implementation Details

The retry functionality is implemented in the following files:

- `src/receipts/pdf-worker.ts`: Contains the automatic retry logic in the worker process
- `src/receipts/pdf-queue.service.ts`: Provides methods for re-enqueueing failed jobs
- `src/receipts/receipts.service.ts`: Implements the business logic for retrying PDF generation
- `src/receipts/receipts.controller.ts`: Exposes the API endpoints for manual retries