-- Notification settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL, -- 'email', 'sms', 'push', 'in_app'
  category VARCHAR(50) NOT NULL, -- 'trading', 'price_alerts', 'system', 'ai'
  enabled BOOLEAN DEFAULT true,
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, channel, category)
);

-- Notification history table
CREATE TABLE IF NOT EXISTS notification_history (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_settings_user 
  ON notification_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_history_user_created 
  ON notification_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_history_user_unread 
  ON notification_history(user_id, read_at) 
  WHERE read_at IS NULL;


