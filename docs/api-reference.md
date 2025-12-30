# API Reference

Complete API documentation for the Command Centre API endpoints.

## Authentication

All `/chat` and `charts` endpoints require `Authorization: Bearer <jwt>` header. See [Authentication.md](./user-authentication.md) for details.

## Base URL

```bash
http://localhost:3000
```

## Chat Module

### Stream AI Chat

```http
POST /chat/stream
```

Streams AI responses for a conversation. Supports both global and page-scoped modes.

#### Request Body (Global Mode)

```json
{
  "conversationId": "uuid",
  "mode": "global",
  "message": {
    "role": "user",
    "parts": [{ "type": "text", "text": "What's my revenue today?" }]
  }
}
```

#### Request Body (Page-Scoped Mode)

```json
{
  "conversationId": "uuid",
  "mode": "page",
  "pageContext": {
    "type": "transaction",
    "resourceId": "123456"
  },
  "message": {
    "role": "user",
    "parts": [{ "type": "text", "text": "What's the status of this transaction?" }]
  }
}
```

#### Parameters

| Parameter                | Type   | Required             | Description                                                      |
| ------------------------ | ------ | -------------------- | ---------------------------------------------------------------- |
| `conversationId`         | UUID   | Yes                  | Unique conversation identifier                                   |
| `mode`                   | string | No                   | Chat mode: `"global"` (default) or `"page"`                      |
| `pageContext`            | object | When mode is "page"  | Resource context                                                 |
| `pageContext.type`       | string | Yes (if pageContext) | One of: `transaction`, `customer`, `refund`, `payout`, `dispute` |
| `pageContext.resourceId` | string | Yes (if pageContext) | Resource identifier                                              |
| `message`                | object | Yes                  | User message object                                              |
| `message.role`           | string | Yes                  | Must be `"user"`                                                 |
| `message.parts`          | array  | Yes                  | Message content parts                                            |

#### Response

Server-sent events stream with UIMessage format.

#### Error Responses

| Status | Code             | Description                         |
| ------ | ---------------- | ----------------------------------- |
| 400    | `invalid_params` | Invalid mode or missing pageContext |
| 404    | `not_found`      | Conversation or resource not found  |
| 429    | `rate_limited`   | Rate limit exceeded                 |

**Conversation Closed Response:**

When streaming to a closed conversation (after 2 summaries), the response will include a refusal message:

```
"This conversation has reached its limit and has been closed. Please start a new conversation or continue from this one to carry over the context."
```

Use `POST /chat/conversations/from-summary` to create a new conversation that carries over the summary context.

**Rate Limit Error Example:**

```json
{
  "status": false,
  "type": "api_error",
  "code": "rate_limited",
  "message": "Rate limit exceeded. You have sent 100 messages in the last 24 hour(s). The limit is 100 messages per 24 hour(s).",
  "data": {
    "limit": 100,
    "periodHours": 24,
    "currentCount": 100
  }
}
```

#### Important Notes

- Once a conversation is created with a specific mode and pageContext, it cannot be changed
- Page-scoped conversations remain locked to the original resource
- Global conversations cannot be converted to page-scoped

---

### Create Conversation

```http
POST /chat/conversations
```

Creates a new conversation. Conversations are typically auto-created when streaming starts, but this endpoint allows manual creation with custom titles.

#### Request Body (Global Mode)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Payment Integration Help",
  "mode": "global"
}
```

#### Request Body (Page-Scoped Mode)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Transaction Inquiry",
  "mode": "page",
  "pageContext": {
    "type": "transaction",
    "resourceId": "123456"
  }
}
```

#### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Payment Integration Help",
  "userId": "user_123",
  "mode": "global",
  "summary": null,
  "summaryCount": 0,
  "previousSummary": null,
  "lastSummarizedMessageId": null,
  "isClosed": false,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

### Create Conversation from Summary

```http
POST /chat/conversations/from-summary
```

Creates a new conversation that continues from a previously closed conversation, carrying over the summary context.

#### Request Body

```json
{
  "previousConversationId": "550e8400-e29b-41d4-a716-446655440000",
  "mode": "global"
}
```

#### Request Body (Page-Scoped)

```json
{
  "previousConversationId": "550e8400-e29b-41d4-a716-446655440000",
  "mode": "page",
  "pageContext": {
    "type": "transaction",
    "resourceId": "123456"
  }
}
```

#### Parameters

| Parameter                | Type   | Required             | Description                                                      |
| ------------------------ | ------ | -------------------- | ---------------------------------------------------------------- |
| `previousConversationId` | UUID   | Yes                  | ID of the closed conversation to continue from                   |
| `mode`                   | string | Yes                  | Chat mode: `"global"` or `"page"`                                |
| `pageContext`            | object | When mode is "page"  | Resource context                                                 |
| `pageContext.type`       | string | Yes (if pageContext) | One of: `transaction`, `customer`, `refund`, `payout`, `dispute` |
| `pageContext.resourceId` | string | Yes (if pageContext) | Resource identifier                                              |

#### Response

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "title": "Payment Integration Help (continued)",
  "userId": "user_123",
  "mode": "global",
  "summary": null,
  "summaryCount": 0,
  "previousSummary": "The user asked about transaction failures. The assistant explained common causes including insufficient funds...",
  "lastSummarizedMessageId": null,
  "isClosed": false,
  "createdAt": "2024-01-02T00:00:00.000Z"
}
```

#### Error Responses

| Status | Code             | Description                              |
| ------ | ---------------- | ---------------------------------------- |
| 400    | `invalid_params` | Invalid input or conversation not closed |
| 404    | `not_found`      | Previous conversation not found          |

---

### Get Conversation

```http
GET /chat/conversations/:id
```

Retrieves a conversation by ID.

#### Parameters

| Parameter | Type | Description     |
| --------- | ---- | --------------- |
| `id`      | UUID | Conversation ID |

#### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Payment Integration Help",
  "userId": "user_123",
  "mode": "global",
  "summary": "The user asked about transaction failures...",
  "summaryCount": 1,
  "previousSummary": null,
  "lastSummarizedMessageId": "message-uuid-123",
  "isClosed": false,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

### Get User Conversations

```http
GET /chat/conversations
```

Retrieves all conversations for the authenticated user with optional filtering.

#### Query Parameters

| Parameter     | Type   | Description                                                                       |
| ------------- | ------ | --------------------------------------------------------------------------------- |
| `mode`        | string | Filter by chat mode: `"global"` or `"page"`                                       |
| `contextType` | string | Filter by resource type: `transaction`, `customer`, `refund`, `payout`, `dispute` |

#### Examples

```http
# Get all conversations
GET /chat/conversations

# Get only global conversations
GET /chat/conversations?mode=global

# Get only page-scoped conversations
GET /chat/conversations?mode=page

# Get all transaction-related conversations
GET /chat/conversations?contextType=transaction

# Get page-scoped transaction conversations
GET /chat/conversations?mode=page&contextType=transaction
```

#### Response

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Payment Integration Help",
    "userId": "user_123",
    "mode": "global",
    "summary": null,
    "summaryCount": 0,
    "previousSummary": null,
    "lastSummarizedMessageId": null,
    "isClosed": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### Delete Conversation

```http
DELETE /chat/conversations/:id
```

Deletes a conversation and all its messages.

#### Parameters

| Parameter | Type | Description     |
| --------- | ---- | --------------- |
| `id`      | UUID | Conversation ID |

#### Response

```json
{
  "status": true,
  "message": "Conversation deleted successfully",
  "data": null
}
```

---

### Delete All Conversations

```http
DELETE /chat/conversations
```

Deletes every conversation for the authenticated user.

#### Response

```json
{
  "status": true,
  "message": "Conversations deleted successfully",
  "data": {
    "deleted": 5
  }
}
```

---

### Create Messages

```http
POST /chat/messages
```

Manually creates one or more messages in a conversation. All messages must belong to the same conversation.

#### Request Body

Accepts an array of message objects:

```json
[
  {
    "id": "987fcdeb-51a2-43e7-b890-123456789abc",
    "conversationId": "550e8400-e29b-41d4-a716-446655440000",
    "role": "user",
    "parts": [{ "type": "text", "text": "How do I integrate payments?" }]
  }
]
```

#### Parameters

| Parameter        | Type   | Required | Description                                    |
| ---------------- | ------ | -------- | ---------------------------------------------- |
| `id`             | UUID   | Yes      | Unique message identifier (UUID v4)            |
| `conversationId` | UUID   | Yes      | Conversation UUID                              |
| `role`           | string | Yes      | Message role: `user`, `assistant`, or `system` |
| `parts`          | array  | Yes      | Message content parts                          |

#### Response

```json
[
  {
    "id": "987fcdeb-51a2-43e7-b890-123456789abc",
    "conversationId": "550e8400-e29b-41d4-a716-446655440000",
    "role": "user",
    "parts": [{ "type": "text", "text": "How do I integrate payments?" }],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Error Responses

| Status | Code             | Description                                            |
| ------ | ---------------- | ------------------------------------------------------ |
| 400    | `invalid_params` | Invalid input or messages from different conversations |
| 404    | `not_found`      | Conversation not found                                 |

---

### Get Messages

```http
GET /chat/messages/:conversationId
```

Retrieves all messages in a conversation.

#### Parameters

| Parameter        | Type | Description     |
| ---------------- | ---- | --------------- |
| `conversationId` | UUID | Conversation ID |

#### Response

```json
[
  {
    "id": "message-uuid",
    "conversationId": "550e8400-e29b-41d4-a716-446655440000",
    "role": "user",
    "parts": [{ "type": "text", "text": "How do I integrate payments?" }],
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "message-uuid-2",
    "conversationId": "550e8400-e29b-41d4-a716-446655440000",
    "role": "assistant",
    "parts": [{ "type": "text", "text": "To integrate payments with Paystack..." }],
    "createdAt": "2024-01-01T00:00:01.000Z"
  }
]
```

---

## Charts Module

### Save Chart

```http
POST /charts
```

Saves a chart configuration with custom name and description. Charts are standalone resources that can be regenerated with fresh data.

#### Request Body

```json
{
  "name": "Daily Revenue Trends",
  "description": "Transaction revenue breakdown by day",
  "createdFromConversationId": "550e8400-e29b-41d4-a716-446655440000",
  "resourceType": "transaction",
  "aggregationType": "by-day",
  "from": "2024-01-01",
  "to": "2024-01-31",
  "status": "success",
  "currency": "NGN",
  "channel": "card"
}
```

#### Parameters

| Parameter                   | Type   | Required | Description                                                                            |
| --------------------------- | ------ | -------- | -------------------------------------------------------------------------------------- |
| `name`                      | string | Yes      | Chart name (max 200 chars)                                                             |
| `description`               | string | No       | Chart description (max 500 chars)                                                      |
| `createdFromConversationId` | UUID   | No       | Optional reference to source conversation                                              |
| `resourceType`              | string | Yes      | One of: `transaction`, `refund`, `payout`, `dispute`                                   |
| `aggregationType`           | string | Yes      | Aggregation type (e.g., `by-day`, `by-week`, `by-status`, `by-channel`)                |
| `from`                      | string | No       | Start date (ISO format)                                                                |
| `to`                        | string | No       | End date (ISO format)                                                                  |
| `status`                    | string | No       | Filter by status                                                                       |
| `currency`                  | string | No       | Filter by currency                                                                     |
| `channel`                   | string | No       | Payment channel filter (transactions only): `card`, `bank`, `mobile_money`, `qr`, etc. |

#### Response

```json
{
  "status": true,
  "message": "Chart saved successfully",
  "data": {
    "id": "chart-123",
    "name": "Daily Revenue Trends",
    "description": "Transaction revenue breakdown by day",
    "createdFromConversationId": "550e8400-e29b-41d4-a716-446655440000",
    "resourceType": "transaction",
    "aggregationType": "by-day",
    "from": "2024-01-01",
    "to": "2024-01-31",
    "status": "success",
    "currency": "NGN",
    "channel": "card",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Error Responses

| Status | Code             | Description                            |
| ------ | ---------------- | -------------------------------------- |
| 400    | `invalid_params` | Invalid aggregation type or date range |

---

### Get All Saved Charts

```http
GET /charts
```

Retrieves all saved charts for the authenticated user, ordered by creation date (newest first).

#### Response

```json
{
  "status": true,
  "message": "Saved charts retrieved successfully",
  "data": [
    {
      "id": "chart-123",
      "name": "Daily Revenue Trends",
      "description": "Transaction revenue breakdown by day",
      "createdFromConversationId": "550e8400-e29b-41d4-a716-446655440000",
      "resourceType": "transaction",
      "aggregationType": "by-day",
      "from": "2024-01-01",
      "to": "2024-01-31",
      "status": "success",
      "currency": "NGN",
      "channel": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Get Saved Chart with Fresh Data

```http
GET /charts/:id
```

Retrieves a saved chart and regenerates it with fresh data from the Paystack API using the saved configuration. Query parameters can override filter values for flexible date ranges and filtering.

**Caching**: Chart data is cached in Redis for 24 hours. Subsequent requests with the same parameters return cached data for optimal performance.

#### Path Parameters

| Parameter | Type   | Description |
| --------- | ------ | ----------- |
| `id`      | string | Chart ID    |

#### Query Parameters (Optional)

All query parameters are optional. If provided, they override the saved configuration values. The `resourceType` and `aggregationType` are immutable and cannot be changed.

| Parameter  | Type   | Description                                         | Example      |
| ---------- | ------ | --------------------------------------------------- | ------------ |
| `from`     | string | Override start date (ISO format)                    | `2024-01-01` |
| `to`       | string | Override end date (ISO format)                      | `2024-01-31` |
| `status`   | string | Override status filter                              | `success`    |
| `currency` | string | Override currency filter                            | `NGN`        |
| `channel`  | string | Override payment channel filter (transactions only) | `card`       |

**Example Request:**

```http
GET /charts/chart-123?from=2024-02-01&to=2024-02-29&status=success&currency=USD&channel=bank
```

This will regenerate the chart with February 2024 data, success status filter, USD currency, and bank channel filter, while keeping the original resourceType and aggregationType.

**Caching Behavior:**

- Each unique combination of parameters creates a separate cache entry
- Cached data is valid for 24 hours
- Changing any parameter (including query overrides) results in a new cache key
- Cache misses trigger fresh data generation from Paystack API

#### Response

```json
{
  "status": true,
  "message": "Chart data retrieved successfully",
  "data": {
    "id": "chart-123",
    "name": "Daily Revenue Trends",
    "description": "Transaction revenue breakdown by day",
    "createdFromConversationId": "550e8400-e29b-41d4-a716-446655440000",
    "resourceType": "transaction",
    "aggregationType": "by-day",
    "from": "2024-01-01",
    "to": "2024-01-31",
    "status": "success",
    "currency": "NGN",
    "channel": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "label": "Daily Transaction Metrics",
    "chartType": "area",
    "chartSeries": [
      {
        "currency": "NGN",
        "points": [
          {
            "name": "Monday, Jan 1",
            "count": 100,
            "volume": 1000000,
            "average": 10000,
            "currency": "NGN"
          }
        ]
      }
    ],
    "summary": {
      "totalCount": 3100,
      "totalVolume": 31000000,
      "overallAverage": 10000,
      "perCurrency": [
        {
          "currency": "NGN",
          "totalCount": 3100,
          "totalVolume": 31000000,
          "overallAverage": 10000
        }
      ],
      "dateRange": {
        "from": "Jan 1, 2024",
        "to": "Jan 31, 2024"
      }
    },
    "message": "Generated chart data with 31 data points from 3100 transactions"
  }
}
```

#### Error Responses

| Status | Code             | Description                      |
| ------ | ---------------- | -------------------------------- |
| 404    | `not_found`      | Chart not found or access denied |
| 400    | `invalid_params` | Chart data generation failed     |

---

### Update Saved Chart

```http
PUT /charts/:id
```

Updates a saved chart's metadata (name and/or description). Chart configuration (resourceType, aggregationType, filters) cannot be changed.

#### Parameters

| Parameter | Type   | Description |
| --------- | ------ | ----------- |
| `id`      | string | Chart ID    |

#### Request Body

```json
{
  "name": "Updated Chart Name",
  "description": "Updated description"
}
```

| Parameter     | Type   | Required | Description                     |
| ------------- | ------ | -------- | ------------------------------- |
| `name`        | string | No       | New chart name (max 200 chars)  |
| `description` | string | No       | New description (max 500 chars) |

At least one field must be provided.

#### Response

```json
{
  "status": true,
  "message": "Chart updated successfully",
  "data": {
    "id": "chart-123",
    "name": "Updated Chart Name",
    "description": "Updated description",
    "resourceType": "transaction",
    "aggregationType": "by-day",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-02T00:00:00.000Z"
  }
}
```

#### Error Responses

| Status | Code             | Description                      |
| ------ | ---------------- | -------------------------------- |
| 400    | `invalid_params` | No fields provided for update    |
| 404    | `not_found`      | Chart not found or access denied |

---

### Delete Saved Chart

```http
DELETE /charts/:id
```

Deletes a saved chart. Only the owner can delete their charts.

#### Parameters

| Parameter | Type   | Description |
| --------- | ------ | ----------- |
| `id`      | string | Chart ID    |

#### Response

```json
{
  "status": true,
  "message": "Chart deleted successfully",
  "data": null
}
```

#### Error Responses

| Status | Code        | Description                      |
| ------ | ----------- | -------------------------------- |
| 404    | `not_found` | Chart not found or access denied |

---

## Health Module

### Health Check

```http
GET /health
```

Returns application health status. **This endpoint is public** (no authentication required).

#### Response

```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "database": {
      "status": "up"
    }
  }
}
```

---

## Swagger Documentation

When the application is running, interactive API documentation is available:

- **Swagger UI**: `http://localhost:3000/swagger`
- **OpenAPI JSON**: `http://localhost:3000/swagger-json`

The Swagger documentation provides:

- Interactive API testing
- Request/response schemas
- Authentication details
- Example payloads
