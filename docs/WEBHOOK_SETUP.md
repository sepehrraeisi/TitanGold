# TitanGold Webhook Setup Guide

**Task:** API-008 - Add Webhook Support  
**Version:** 1.0.0  
**Date:** 2026-01-31

## Overview

TitanGold webhooks allow you to receive real-time HTTP notifications when AI agents complete execution, fail, timeout, or encounter errors. Webhooks are secured with HMAC-SHA256 signature verification and include automatic retry logic with exponential backoff.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Webhook Events](#webhook-events)
3. [Registering a Webhook](#registering-a-webhook)
4. [Signature Verification](#signature-verification)
5. [Handling Webhooks](#handling-webhooks)
6. [Retry Logic](#retry-logic)
7. [Testing Webhooks](#testing-webhooks)
8. [API Reference](#api-reference)
9. [Examples](#examples)
10. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Create a webhook endpoint

```javascript
// Express.js example
app.post('/webhooks/titangold', (req, res) => {
  const signature = req.headers['x-titangold-signature'];
  const payload = JSON.stringify(req.body);
  
  // Verify signature (see Signature Verification section)
  if (!verifySignature(payload, signature, YOUR_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process the event
  const { event, data } = req.body;
  console.log(`Received ${event}:`, data);
  
  res.status(200).json({ received: true });
});
```

### 2. Register your webhook

```bash
curl -X POST https://api.titangold.com/api/v1/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhooks/titangold",
    "events": ["agent.completed", "agent.failed"]
  }'
```

### 3. Save your secret

The response includes a `secret` key - **save this securely**. You'll need it to verify webhook signatures.

```json
{
  "ok": true,
  "webhook": {
    "id": 123,
    "url": "https://your-domain.com/webhooks/titangold",
    "events": ["agent.completed", "agent.failed"],
    "secret": "a1b2c3d4e5f6...",
    "is_active": true,
    "created_at": "2026-01-31T12:00:00Z"
  }
}
```

⚠️ **IMPORTANT**: The secret is only returned during webhook creation. Store it securely.

---

## Webhook Events

TitanGold supports the following webhook events:

| Event | Description | Trigger |
|-------|-------------|---------|
| `agent.started` | Agent execution has started | When agent begins processing |
| `agent.completed` | Agent completed successfully | When agent finishes successfully |
| `agent.failed` | Agent execution failed | When agent encounters an error |
| `agent.timeout` | Agent execution timed out | When agent exceeds time limit |
| `agent.error` | General agent error | When agent encounters any error |

### Event Payload Structure

All webhook events follow this structure:

```json
{
  "event": "agent.completed",
  "timestamp": "2026-01-31T12:30:45Z",
  "data": {
    "agent_id": "550e8400-e29b-41d4-a716-446655440000",
    "agent_key": "TECHNICAL",
    "agent_name": "Technical Analysis Agent",
    "symbol": "BTCUSDT",
    "timeframe": "1h",
    "result": {
      // Agent-specific result data
    }
  }
}
```

---

## Registering a Webhook

### Endpoint

```
POST /api/v1/webhooks
```

### Authentication

Requires JWT token in Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Request Body

```json
{
  "url": "https://your-domain.com/webhooks/titangold",
  "events": ["agent.completed", "agent.failed", "agent.timeout"],
  "metadata": {
    "description": "Production webhook",
    "environment": "production"
  }
}
```

**Fields:**
- `url` (required): HTTPS endpoint to receive webhooks
- `events` (required): Array of event types to subscribe to
- `metadata` (optional): Custom metadata object

### Response

```json
{
  "ok": true,
  "webhook": {
    "id": 123,
    "url": "https://your-domain.com/webhooks/titangold",
    "secret": "a1b2c3d4e5f6...",
    "events": ["agent.completed", "agent.failed", "agent.timeout"],
    "is_active": true,
    "created_at": "2026-01-31T12:00:00Z",
    "metadata": {
      "description": "Production webhook",
      "environment": "production"
    }
  }
}
```

⚠️ **Save the `secret` field** - it's only returned once during creation.

---

## Signature Verification

Every webhook request includes an HMAC-SHA256 signature in the `X-TitanGold-Signature` header for security.

### Verification Process

1. Extract the signature from the header
2. Compute HMAC-SHA256 of the raw request body using your webhook secret
3. Compare the computed signature with the received signature

### Implementation Examples

#### Node.js

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}

// Express middleware
app.use('/webhooks/titangold', express.raw({ type: 'application/json' }));

app.post('/webhooks/titangold', (req, res) => {
  const signature = req.headers['x-titangold-signature'];
  const payload = req.body.toString('utf8');
  
  if (!verifySignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const event = JSON.parse(payload);
  // Process event...
  
  res.status(200).json({ received: true });
});
```

#### Python (Flask)

```python
import hmac
import hashlib

def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    computed_signature = hmac.new(
        secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, computed_signature)

@app.route('/webhooks/titangold', methods=['POST'])
def webhook():
    signature = request.headers.get('X-TitanGold-Signature')
    payload = request.get_data()
    
    if not verify_signature(payload, signature, WEBHOOK_SECRET):
        return jsonify({'error': 'Invalid signature'}), 401
    
    event = request.get_json()
    # Process event...
    
    return jsonify({'received': True}), 200
```

#### Go

```go
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "crypto/subtle"
    "encoding/hex"
)

func verifySignature(payload []byte, signature string, secret string) bool {
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write(payload)
    expectedMAC := hex.EncodeToString(mac.Sum(nil))
    
    return subtle.ConstantTimeCompare(
        []byte(signature),
        []byte(expectedMAC)
    ) == 1
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
    signature := r.Header.Get("X-TitanGold-Signature")
    payload, _ := ioutil.ReadAll(r.Body)
    
    if !verifySignature(payload, signature, webhookSecret) {
        http.Error(w, "Invalid signature", http.StatusUnauthorized)
        return
    }
    
    // Process event...
    
    json.NewEncoder(w).Encode(map[string]bool{"received": true})
}
```

---

## Handling Webhooks

### Best Practices

1. **Respond quickly**: Return 200 OK within 5 seconds
2. **Process asynchronously**: Queue long-running tasks
3. **Verify signatures**: Always verify HMAC signature
4. **Handle idempotency**: Use event IDs to prevent duplicate processing
5. **Log all events**: Keep audit trail of received webhooks

### Example: Async Processing

```javascript
// Express with Bull queue
const Queue = require('bull');
const webhookQueue = new Queue('webhooks');

app.post('/webhooks/titangold', async (req, res) => {
  const signature = req.headers['x-titangold-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifySignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Add to queue for async processing
  await webhookQueue.add({
    event: req.body.event,
    data: req.body.data,
    timestamp: req.body.timestamp
  });
  
  // Respond immediately
  res.status(200).json({ received: true });
});

// Process queue
webhookQueue.process(async (job) => {
  const { event, data } = job.data;
  
  switch (event) {
    case 'agent.completed':
      await handleAgentCompleted(data);
      break;
    case 'agent.failed':
      await handleAgentFailed(data);
      break;
    // ... handle other events
  }
});
```

---

## Retry Logic

TitanGold automatically retries failed webhook deliveries with exponential backoff.

### Retry Schedule

- **Attempt 1**: Immediate delivery
- **Attempt 2**: After 1 minute
- **Attempt 3**: After 5 minutes
- **Max attempts**: 3

### Success Criteria

A webhook delivery is considered successful if your endpoint:
- Returns HTTP status 200-299
- Responds within 10 seconds

### Failure Handling

If all 3 attempts fail:
- Webhook is marked as failed
- Error details are stored
- No further retries are attempted
- You can view failed deliveries in the delivery history

### Viewing Delivery History

```bash
curl -X GET https://api.titangold.com/api/v1/webhooks/123/deliveries \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:

```json
{
  "ok": true,
  "deliveries": [
    {
      "id": 456,
      "event_type": "agent.completed",
      "response_status": 200,
      "attempt_count": 1,
      "succeeded": true,
      "created_at": "2026-01-31T12:30:00Z",
      "completed_at": "2026-01-31T12:30:01Z"
    },
    {
      "id": 457,
      "event_type": "agent.failed",
      "response_status": 500,
      "attempt_count": 3,
      "succeeded": false,
      "created_at": "2026-01-31T13:00:00Z",
      "error_message": "Connection timeout"
    }
  ],
  "pagination": {
    "total": 2,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## Testing Webhooks

### Test Endpoint

Use webhook.site or similar services to receive test webhooks:

1. Go to https://webhook.site
2. Copy your unique URL
3. Register webhook with that URL
4. Use the test endpoint

### Test Command

```bash
curl -X POST https://api.titangold.com/api/v1/webhooks/123/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:

```json
{
  "ok": true,
  "message": "Test webhook dispatched",
  "deliveryId": 789
}
```

Your endpoint will receive:

```json
{
  "event": "webhook.test",
  "timestamp": "2026-01-31T12:00:00Z",
  "data": {
    "message": "This is a test webhook delivery",
    "webhookId": 123
  }
}
```

---

## API Reference

### Create Webhook

```
POST /api/v1/webhooks
```

**Body:**
```json
{
  "url": "https://your-domain.com/webhooks",
  "events": ["agent.completed"],
  "metadata": {}
}
```

### List Webhooks

```
GET /api/v1/webhooks
```

### Get Webhook

```
GET /api/v1/webhooks/:id
```

### Update Webhook

```
PATCH /api/v1/webhooks/:id
```

**Body:**
```json
{
  "url": "https://new-url.com/webhooks",
  "events": ["agent.completed", "agent.failed"],
  "is_active": true
}
```

### Delete Webhook

```
DELETE /api/v1/webhooks/:id
```

### Get Delivery History

```
GET /api/v1/webhooks/:id/deliveries?limit=50&offset=0
```

### Test Webhook

```
POST /api/v1/webhooks/:id/test
```

### List Available Events

```
GET /api/v1/webhooks/events
```

---

## Examples

### Complete Node.js Server

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Important: Use raw body for signature verification
app.use('/webhooks', express.raw({ type: 'application/json' }));

function verifySignature(payload, signature, secret) {
  const computed = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computed)
  );
}

app.post('/webhooks/titangold', (req, res) => {
  const signature = req.headers['x-titangold-signature'];
  
  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }
  
  const payload = req.body.toString('utf8');
  
  if (!verifySignature(payload, signature, WEBHOOK_SECRET)) {
    console.error('Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const event = JSON.parse(payload);
  console.log('Received webhook:', event);
  
  // Process event based on type
  switch (event.event) {
    case 'agent.completed':
      console.log(`Agent ${event.data.agent_key} completed:`, event.data.result);
      // Send notification, update dashboard, etc.
      break;
      
    case 'agent.failed':
      console.error(`Agent ${event.data.agent_key} failed:`, event.data.error_message);
      // Alert on-call engineer, log to monitoring system
      break;
      
    case 'agent.timeout':
      console.warn(`Agent ${event.data.agent_key} timed out`);
      // Investigate slow agents
      break;
  }
  
  res.status(200).json({ received: true });
});

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000');
});
```

### Python FastAPI Server

```python
from fastapi import FastAPI, Request, HTTPException
import hmac
import hashlib
import os

app = FastAPI()
WEBHOOK_SECRET = os.getenv('WEBHOOK_SECRET')

def verify_signature(payload: bytes, signature: str) -> bool:
    computed = hmac.new(
        WEBHOOK_SECRET.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, computed)

@app.post("/webhooks/titangold")
async def webhook_handler(request: Request):
    signature = request.headers.get('x-titangold-signature')
    
    if not signature:
        raise HTTPException(status_code=401, detail="Missing signature")
    
    payload = await request.body()
    
    if not verify_signature(payload, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    event = await request.json()
    
    # Process event
    if event['event'] == 'agent.completed':
        print(f"Agent {event['data']['agent_key']} completed")
        # Handle completion
    elif event['event'] == 'agent.failed':
        print(f"Agent {event['data']['agent_key']} failed")
        # Handle failure
    
    return {"received": True}
```

---

## Troubleshooting

### Webhook not receiving events

1. **Check webhook is active**:
   ```bash
   curl -X GET https://api.titangold.com/api/v1/webhooks/123 \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
   Verify `is_active: true`

2. **Check subscribed events**:
   Ensure the event you're expecting is in the `events` array

3. **Check delivery history**:
   ```bash
   curl -X GET https://api.titangold.com/api/v1/webhooks/123/deliveries \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
   Look for failed deliveries and error messages

### Signature verification fails

1. **Use raw body**: Don't parse JSON before verification
2. **Check secret**: Ensure you're using the correct secret
3. **Header name**: Case-sensitive, use `x-titangold-signature`
4. **Encoding**: Use hex encoding, not base64

### Slow webhook processing

1. **Respond quickly**: Return 200 within 5 seconds
2. **Process async**: Use job queue for heavy processing
3. **Timeout**: Webhook delivery timeout is 10 seconds

### Events firing multiple times

1. **Implement idempotency**: Track delivery IDs
2. **Check retry attempts**: Failed deliveries are retried up to 3 times

---

## Security Considerations

1. **Always verify signatures**: Never process unverified webhooks
2. **Use HTTPS only**: HTTP webhooks are rejected
3. **Whitelist IPs**: Optionally restrict webhook source IPs
4. **Rate limiting**: Implement rate limiting on your endpoint
5. **Secret rotation**: Rotate webhook secrets periodically

---

## Support

For questions or issues:
- GitHub Issues: https://github.com/titangold/api/issues
- Documentation: https://docs.titangold.com/webhooks
- Email: support@titangold.com

---

**Last Updated:** 2026-01-31  
**API Version:** v1  
**Task:** API-008 - Add Webhook Support
