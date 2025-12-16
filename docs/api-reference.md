# API Reference

Complete API documentation for the Command Centre API endpoints.

## Authentication

All `/chat` endpoints require `Authorization: Bearer <jwt>` header. See [Authentication.md](./authentication.md) for details.

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

```bash
204 No Content
```

---

### Delete All Conversations

```http
DELETE /chat/conversations
```

Deletes every conversation for the authenticated user.

#### Response

```bash
204 No Content
```

---

### Create Message

```http
POST /chat/messages
```

Manually creates a message in a conversation.

#### Request Body

```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "role": "user",
  "parts": [{ "type": "text", "text": "How do I integrate payments?" }]
}
```

#### Response

```json
{
  "id": "message-uuid",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "role": "user",
  "parts": [{ "type": "text", "text": "How do I integrate payments?" }],
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

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
