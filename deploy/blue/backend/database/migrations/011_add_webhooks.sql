-- API-008: Add Webhook Support
-- Create webhooks table and webhook_deliveries table
-- Date: 2026-01-31

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL, -- Used for signature verification
  events TEXT[] NOT NULL, -- Array of event types to listen for
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_triggered_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT webhooks_url_check CHECK (url ~ '^https?://'),
  CONSTRAINT webhooks_events_not_empty CHECK (array_length(events, 1) > 0)
);

-- Webhook deliveries table (for tracking and retry logic)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id SERIAL PRIMARY KEY,
  webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  attempt_count INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  succeeded BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  next_retry_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active ON webhooks(is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at) WHERE succeeded = false AND attempt_count < max_attempts;
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS webhooks_updated_at_trigger ON webhooks;
CREATE TRIGGER webhooks_updated_at_trigger
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_webhooks_updated_at();

-- Comments
COMMENT ON TABLE webhooks IS 'User-registered webhooks for agent event notifications (API-008)';
COMMENT ON TABLE webhook_deliveries IS 'Tracks webhook delivery attempts and retry logic (API-008)';
COMMENT ON COLUMN webhooks.secret IS 'Secret key for HMAC-SHA256 signature verification';
COMMENT ON COLUMN webhooks.events IS 'Event types: agent.completed, agent.failed, agent.started';
COMMENT ON COLUMN webhook_deliveries.next_retry_at IS 'Timestamp for next retry attempt (exponential backoff)';
