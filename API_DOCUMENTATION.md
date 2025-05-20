# TRA Receipts API Documentation

This document outlines the available API endpoints for the TRA Receipts application, how to interact with them, and expected request/response formats.

**Base URL**: `http://localhost:3000` (assuming the default NestJS port)

---

## Receipts API (`/receipts`)

Handles operations related to receipts, including creation, verification, and retrieval.

### 1. Create and Verify a Receipt

*   **Endpoint**: `POST /receipts`
*   **Description**: Creates a new receipt record in the system and attempts to verify it with the TRA (Tanzania Revenue Authority) using the provided `verificationSecret`.
*   **Request Body**: `application/json`

    The request body should be a JSON object matching the `CreateReceiptDto` structure:

    ```json
    {
      "receiptNumber": "string", // Unique identifier for the receipt (e.g., from the physical receipt)
      "verificationSecret": "string", // The HH:MM:SS secret for the TRA API (e.g., "12:04:04")
      "issueDate": "string", // ISO 8601 date string (e.g., "2023-10-27T10:30:00.000Z")
      "totalAmount": "number", // Total amount of the receipt
      "items": [ // Optional: Array of items on the receipt
        { "itemName": "Product A", "quantity": 2, "price": 50.00 },
        { "itemName": "Service B", "quantity": 1, "price": 150.00 }
      ],
      "customerName": "string" // Name of the customer
    }
    ```
    *   `receiptNumber`: (String, Required) Your internal unique identifier for the receipt.
    *   `verificationSecret`: (String, Required) The time-based secret (format HH:MM:SS) obtained from the TRA system for verification. Example: `"12:04:04"`.
    *   `issueDate`: (String, Required) The date the receipt was issued, in ISO 8601 format.
    *   `totalAmount`: (Number, Required) The total monetary value of the receipt.
    *   `items`: (Array of Objects, Optional) A list of items included in the receipt. Each item can have its own structure (e.g., `itemName`, `quantity`, `price`).
    *   `customerName`: (String, Required) The name of the customer associated with the receipt.

*   **Success Response**:
    *   **Code**: `201 Created`
    *   **Content**: The created receipt object from the database, including its `id`, `isVerified` status, and other details.
        ```json
        {
          "id": "uuid-string-generated-by-db",
          "receiptNumber": "RN12345",
          "issueDate": "2023-10-27T10:30:00.000Z",
          "totalAmount": "250.00",
          "items": [
            { "itemName": "Product A", "quantity": 2, "price": 50.00 },
            { "itemName": "Service B", "quantity": 1, "price": 150.00 }
          ],
          "customerName": "John Doe",
          "isVerified": true, // or false, depending on TRA verification
          "verificationDetails": "Successfully verified by TRA (mock parsing).", // Details from TRA verification
          "verifiedByTRAAt": "2023-10-27T12:05:00.000Z", // Timestamp of TRA verification, if successful
          "createdAt": "2023-10-27T12:00:00.000Z",
          "updatedAt": "2023-10-27T12:00:00.000Z"
        }
        ```

*   **Error Responses**:
    *   **Code**: `400 Bad Request` (If request body validation fails, e.g., missing fields, incorrect `verificationSecret` format)
    *   **Code**: `500 Internal Server Error` (If there's an issue with the TRA API call or database operation)

### 2. Get All Receipts

*   **Endpoint**: `GET /receipts`
*   **Description**: Retrieves a list of all receipts stored in the system.
*   **Request Body**: None
*   **Success Response**:
    *   **Code**: `200 OK`
    *   **Content**: An array of receipt objects.
        ```json
        [
          {
            "id": "uuid-string-1",
            "receiptNumber": "RN12345",
            // ... other receipt fields
          },
          {
            "id": "uuid-string-2",
            "receiptNumber": "RN67890",
            // ... other receipt fields
          }
        ]
        ```
*   **Error Responses**:
    *   **Code**: `500 Internal Server Error`

### 3. Get a Specific Receipt by ID

*   **Endpoint**: `GET /receipts/:id`
*   **Description**: Retrieves a single receipt by its unique database ID (UUID).
*   **URL Parameters**:
    *   `id` (string, required): The UUID of the receipt to retrieve.
*   **Request Body**: None
*   **Success Response**:
    *   **Code**: `200 OK`
    *   **Content**: The receipt object.
        ```json
        {
          "id": "uuid-string-for-the-requested-receipt",
          "receiptNumber": "RN12345",
          // ... other receipt fields
        }
        ```
*   **Error Responses**:
    *   **Code**: `400 Bad Request` (If `id` is not a valid UUID)
    *   **Code**: `404 Not Found` (If no receipt with the given `id` exists)
    *   **Code**: `500 Internal Server Error`

---

## General Notes

*   **Authentication**: Currently, no authentication is implemented. This should be added for production environments.
*   **Error Handling**: Standard HTTP status codes are used. Error responses may include a `message` field with more details.
*   **TRA Verification**: The `verificationSecret` is used to interact with an external TRA API. The success of this verification (`isVerified` field) depends on the TRA system's response. The exact parsing logic for the TRA response is critical and located in `ReceiptsService`.

---

**This document should be updated whenever new API endpoints are created or existing ones are modified.**