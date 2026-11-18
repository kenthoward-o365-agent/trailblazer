# RoomMaster POS Integration API Documentation

**Version:** 1.0  
**Last Updated:** January 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Authentication](#authentication)
4. [Rate Limits](#rate-limits)
5. [API Endpoints](#api-endpoints)
   - [Room Lookup](#1-room-lookup)
   - [Account List](#2-account-list)
   - [Post Charge](#3-post-charge)
6. [Error Handling](#error-handling)
7. [Integration Flow](#integration-flow)
8. [Code Examples](#code-examples)
9. [Best Practices](#best-practices)
10. [Testing Checklist](#testing-checklist)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The RoomMaster POS Integration API enables Point-of-Sale systems to:

- **Look up in-house guests** by room number
- **Retrieve F&B account mappings** with POS-specific codes
- **Post charges directly** to guest folios

### Base URL

```
https://xavsdfewzwdonndfcehh.supabase.co/functions/v1/pos-api
```

### Content Type

All requests and responses use JSON:

```
Content-Type: application/json
```

---

## Quick Start

### Step 1: Get Your API Key

Contact your property administrator to obtain an API key with the required scopes:
- `pos:read` - For room lookup and account retrieval
- `pos:write` - For posting charges

### Step 2: Make Your First Request

```bash
curl -X GET "https://xavsdfewzwdonndfcehh.supabase.co/functions/v1/pos-api/rooms/101" \
  -H "x-api-key: rm_your_api_key_here"
```

### Step 3: Review Account Mappings

```bash
curl -X GET "https://xavsdfewzwdonndfcehh.supabase.co/functions/v1/pos-api/accounts" \
  -H "x-api-key: rm_your_api_key_here"
```

---

## Authentication

All API requests require an API key in the `x-api-key` header:

```
x-api-key: rm_xxxxxxxxxxxxxxxx
```

### API Key Properties

| Property | Description |
|----------|-------------|
| Format | `rm_` prefix followed by 16 alphanumeric characters |
| Scope | Property-specific (each key is tied to one property) |
| Permissions | Defined by scopes assigned during key creation |

### Required Scopes

| Endpoint | Required Scope |
|----------|----------------|
| `GET /rooms/{room}` | `pos:read` |
| `GET /accounts` | `pos:read` |
| `POST /postings` | `pos:write` |

---

## Rate Limits

| Limit Type | Default Value |
|------------|---------------|
| Requests per minute | 60 |
| Configurable | Yes (per API key) |

When rate limited, the API returns:

```json
{
  "success": false,
  "error": "Rate limit exceeded"
}
```

**HTTP Status:** `429 Too Many Requests`

---

## API Endpoints

### 1. Room Lookup

Look up an in-house guest by room number.

**Endpoint:** `GET /pos-api/rooms/{room_number}`

**Required Scope:** `pos:read`

#### Request

```bash
GET /pos-api/rooms/101
x-api-key: rm_your_api_key_here
```

#### Success Response (200)

```json
{
  "success": true,
  "guest_name": "John Smith",
  "folio_id": "550e8400-e29b-41d4-a716-446655440000",
  "reservation_id": "550e8400-e29b-41d4-a716-446655440001",
  "check_in_date": "2026-01-10",
  "check_out_date": "2026-01-15",
  "current_balance": 245.50
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` on success |
| `guest_name` | string | Guest's full name |
| `folio_id` | string | UUID of the guest's folio (ledger account) |
| `reservation_id` | string | UUID of the reservation |
| `check_in_date` | string | Check-in date (YYYY-MM-DD) |
| `check_out_date` | string | Scheduled check-out date (YYYY-MM-DD) |
| `current_balance` | number | Current folio balance |

#### Error Response (404)

```json
{
  "success": false,
  "error": "No in-house guest found for room 101"
}
```

---

### 2. Account List

Retrieve all F&B revenue accounts with their POS code mappings.

**Endpoint:** `GET /pos-api/accounts`

**Required Scope:** `pos:read`

#### Request

```bash
GET /pos-api/accounts
x-api-key: rm_your_api_key_here
```

#### Success Response (200)

```json
{
  "success": true,
  "accounts": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "code": "2000",
      "name": "Restaurant Revenue",
      "pos_code": "POS_RESTAURANT"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440011",
      "code": "2010",
      "name": "Bar Revenue",
      "pos_code": "POS_BAR"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440012",
      "code": "2020",
      "name": "Room Service",
      "pos_code": "POS_ROOM_SERVICE"
    }
  ]
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `accounts` | array | List of F&B revenue accounts |
| `accounts[].id` | string | Account UUID |
| `accounts[].code` | string | Account code (e.g., "2000") |
| `accounts[].name` | string | Account name |
| `accounts[].pos_code` | string | POS-specific mapping code |

**Note:** Only accounts with a `pos_code` assigned are returned.

---

### 3. Post Charge

Post a charge to a guest's folio.

**Endpoint:** `POST /pos-api/postings`

**Required Scope:** `pos:write`

#### Request

```bash
POST /pos-api/postings
Content-Type: application/json
x-api-key: rm_your_api_key_here

{
  "room_number": "101",
  "pos_code": "POS_RESTAURANT",
  "amount": 45.50,
  "description": "Dinner - Table 12",
  "check_number": "CK#123456",
  "pos_transaction_id": "POS-2026-00001"
}
```

#### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `room_number` | string | Yes | Guest's room number |
| `pos_code` | string | Yes | POS code mapped to revenue account |
| `amount` | number | Yes | Charge amount (positive number) |
| `description` | string | Yes | Charge description |
| `check_number` | string | No | POS check/ticket number |
| `pos_transaction_id` | string | No | Unique POS transaction ID (for reconciliation) |

#### Success Response (200)

```json
{
  "success": true,
  "posting_id": "550e8400-e29b-41d4-a716-446655440099",
  "guest_name": "John Smith",
  "new_balance": 291.00,
  "message": "Charge of $45.50 posted successfully"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` on success |
| `posting_id` | string | UUID of the created folio posting |
| `guest_name` | string | Guest's full name |
| `new_balance` | number | Updated folio balance |
| `message` | string | Human-readable confirmation |

#### Error Responses

**Invalid POS Code (400)**
```json
{
  "success": false,
  "error": "POS code 'INVALID_CODE' not found"
}
```

**Room Not Found (404)**
```json
{
  "success": false,
  "error": "No in-house guest found for room 101"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Invalid request body or parameters |
| 401 | Unauthorized | Missing or invalid API key |
| 403 | Forbidden | API key lacks required scope |
| 404 | Not Found | Resource not found (room/guest/account) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |

### Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Missing or invalid API key" | No `x-api-key` header | Add valid API key to header |
| "API key has been revoked" | Key was deactivated | Request new key from admin |
| "Insufficient permissions" | Key lacks required scope | Request key with correct scopes |
| "No in-house guest found" | Guest not checked in | Verify room number and check-in status |
| "POS code not found" | Unmapped account | Check Integration Mappings in property settings |

---

## Integration Flow

### Typical POS Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         POS INTEGRATION FLOW                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. STARTUP                                                         │
│     ┌─────────────────┐                                            │
│     │ GET /accounts   │ ──► Cache POS code mappings               │
│     └─────────────────┘                                            │
│                                                                     │
│  2. GUEST CHARGES MEAL                                             │
│     ┌─────────────────┐                                            │
│     │ Guest: "Room    │ ──► Cashier enters room number            │
│     │ 101 please"     │                                            │
│     └─────────────────┘                                            │
│            │                                                        │
│            ▼                                                        │
│     ┌─────────────────┐                                            │
│     │ GET /rooms/101  │ ──► Verify guest is in-house              │
│     └─────────────────┘                                            │
│            │                                                        │
│            ▼                                                        │
│     ┌─────────────────┐                                            │
│     │ Display guest   │ ──► "John Smith - Room 101"               │
│     │ name for confirm│     "Current balance: $245.50"            │
│     └─────────────────┘                                            │
│            │                                                        │
│            ▼                                                        │
│     ┌─────────────────┐                                            │
│     │ Guest signs     │ ──► Confirm charge                        │
│     └─────────────────┘                                            │
│            │                                                        │
│            ▼                                                        │
│     ┌─────────────────┐                                            │
│     │ POST /postings  │ ──► Post charge to folio                  │
│     └─────────────────┘                                            │
│            │                                                        │
│            ▼                                                        │
│     ┌─────────────────┐                                            │
│     │ Store posting_id│ ──► For reconciliation                    │
│     └─────────────────┘                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Code Examples

### JavaScript/TypeScript

```typescript
const API_BASE = 'https://xavsdfewzwdonndfcehh.supabase.co/functions/v1/pos-api';
const API_KEY = 'rm_your_api_key_here';

// Helper function for API calls
async function posApiCall(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...options.headers,
    },
  });
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error);
  }
  
  return data;
}

// Room Lookup
async function lookupRoom(roomNumber: string) {
  return await posApiCall(`/rooms/${roomNumber}`);
}

// Get Account Mappings
async function getAccounts() {
  return await posApiCall('/accounts');
}

// Post Charge
async function postCharge(
  roomNumber: string,
  posCode: string,
  amount: number,
  description: string,
  checkNumber?: string
) {
  return await posApiCall('/postings', {
    method: 'POST',
    body: JSON.stringify({
      room_number: roomNumber,
      pos_code: posCode,
      amount,
      description,
      check_number: checkNumber,
      pos_transaction_id: `POS-${Date.now()}`,
    }),
  });
}

// Usage Example
async function chargeGuestMeal() {
  try {
    // 1. Verify guest
    const guest = await lookupRoom('101');
    console.log(`Guest: ${guest.guest_name}`);
    
    // 2. Post charge
    const result = await postCharge(
      '101',
      'POS_RESTAURANT',
      45.50,
      'Dinner - Table 12',
      'CK#123456'
    );
    
    console.log(`Posted! New balance: $${result.new_balance}`);
    console.log(`Posting ID: ${result.posting_id}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}
```

### cURL Examples

**Room Lookup:**
```bash
curl -X GET \
  "https://xavsdfewzwdonndfcehh.supabase.co/functions/v1/pos-api/rooms/101" \
  -H "x-api-key: rm_your_api_key_here"
```

**Get Accounts:**
```bash
curl -X GET \
  "https://xavsdfewzwdonndfcehh.supabase.co/functions/v1/pos-api/accounts" \
  -H "x-api-key: rm_your_api_key_here"
```

**Post Charge:**
```bash
curl -X POST \
  "https://xavsdfewzwdonndfcehh.supabase.co/functions/v1/pos-api/postings" \
  -H "x-api-key: rm_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "room_number": "101",
    "pos_code": "POS_RESTAURANT",
    "amount": 45.50,
    "description": "Dinner - Table 12",
    "check_number": "CK#123456",
    "pos_transaction_id": "POS-2026-00001"
  }'
```

---

## Best Practices

### 1. Cache Account Mappings

Fetch account mappings once at POS startup and refresh periodically:

```typescript
// Cache accounts at startup
let accountCache = await getAccounts();

// Refresh every hour
setInterval(async () => {
  accountCache = await getAccounts();
}, 60 * 60 * 1000);
```

### 2. Always Verify Room First

Before posting charges, always verify the guest is in-house:

```typescript
async function chargeToRoom(roomNumber: string, amount: number) {
  // Step 1: Verify guest
  const guest = await lookupRoom(roomNumber);
  
  // Step 2: Display for confirmation
  displayConfirmation(`Charge $${amount} to ${guest.guest_name}?`);
  
  // Step 3: Post after confirmation
  return await postCharge(roomNumber, 'POS_RESTAURANT', amount, 'Meal');
}
```

### 3. Store Posting IDs

Always store the `posting_id` from successful charges for:
- End-of-day reconciliation
- Dispute resolution
- Audit trails

### 4. Use Unique Transaction IDs

Generate unique `pos_transaction_id` values for each transaction:

```typescript
const transactionId = `POS-${new Date().toISOString().slice(0,10)}-${sequenceNumber}`;
```

### 5. Handle Errors Gracefully

```typescript
try {
  const result = await postCharge(...);
} catch (error) {
  if (error.message.includes('No in-house guest')) {
    showError('Guest not found. Please verify room number.');
  } else if (error.message.includes('Rate limit')) {
    showError('Too many requests. Please wait and try again.');
  } else {
    showError('Unable to post charge. Please try again.');
    logError(error);
  }
}
```

---

## Testing Checklist

### Pre-Production Testing

- [ ] **API Key Validation**
  - [ ] Valid key returns expected data
  - [ ] Invalid key returns 401
  - [ ] Missing key returns 401
  - [ ] Revoked key returns 401

- [ ] **Room Lookup**
  - [ ] In-house guest returns correct data
  - [ ] Empty room returns 404
  - [ ] Checked-out guest returns 404

- [ ] **Account Mappings**
  - [ ] All mapped accounts are returned
  - [ ] Unmapped accounts are excluded
  - [ ] POS codes match configuration

- [ ] **Posting Charges**
  - [ ] Valid charge posts successfully
  - [ ] Posting ID is returned
  - [ ] Balance updates correctly
  - [ ] Invalid POS code returns 400
  - [ ] Invalid room returns 404

- [ ] **Error Handling**
  - [ ] All error codes are handled
  - [ ] Error messages are displayed appropriately
  - [ ] Failed charges don't affect POS workflow

### Go-Live Checklist

- [ ] API key with correct scopes obtained
- [ ] Base URL configured correctly
- [ ] Account mappings verified
- [ ] Test charges posted and voided
- [ ] Error handling tested
- [ ] Reconciliation process documented

---

## Troubleshooting

### Common Issues

| Issue | Possible Cause | Solution |
|-------|----------------|----------|
| "Missing or invalid API key" | Wrong header name | Use `x-api-key` (lowercase) |
| "API key has been revoked" | Key deactivated | Request new key from admin |
| "Insufficient permissions" | Wrong scopes | Request `pos:read` and `pos:write` |
| "No in-house guest found" | Guest checked out | Verify check-in status in PMS |
| "POS code not found" | Account not mapped | Map account in Integration Mappings |
| Connection timeout | Network issues | Check firewall and DNS settings |
| Rate limited | Too many requests | Implement request queuing |

### Support Contacts

For integration support, contact your property administrator who can:
- Generate new API keys
- Configure account mappings
- Adjust rate limits
- Review API logs

---

## Appendix: Folio Posting Details

When charges are posted via the POS API, they appear in the guest folio with:

| Field | Value |
|-------|-------|
| Entry Type | Charge (Debit) |
| Description | `[Check Number] [Description]` |
| Posted By | "POS System" |
| Reference | POS transaction ID |
| Account | Mapped revenue account |

### Example Folio Entry

```
Date:        2026-01-12 19:45:00
Description: CK#123456 Dinner - Table 12
Debit:       $45.50
Account:     2000 - Restaurant Revenue
Posted By:   POS System
Reference:   POS-2026-00001
```

---

*This documentation is for RoomMaster POS Integration API v1.0*
