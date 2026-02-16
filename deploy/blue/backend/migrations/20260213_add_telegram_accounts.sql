-- 2026-02-13: Multi-Account Telegram Collector - telegram_accounts & channel linkage (blue)

CREATE TABLE IF NOT EXISTS telegram_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending_login',
    session_string TEXT,
    last_login_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    last_flood_until TIMESTAMPTZ,
    is_primary BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT telegram_accounts_status_check
        CHECK (status IN ('active', 'disabled', 'flooded', 'error', 'pending_login'))
);

CREATE INDEX IF NOT EXISTS idx_telegram_accounts_status ON telegram_accounts(status);
CREATE INDEX IF NOT EXISTS idx_telegram_accounts_last_used ON telegram_accounts(last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_accounts_flood_until ON telegram_accounts(last_flood_until);

COMMENT ON TABLE telegram_accounts IS 'Telegram MTProto accounts used by the Telegram Collector (multi-account support)';
COMMENT ON COLUMN telegram_accounts.phone IS 'E.164 formatted phone number for the Telegram account';
COMMENT ON COLUMN telegram_accounts.status IS 'Account status: active, disabled, flooded, error, pending_login';
COMMENT ON COLUMN telegram_accounts.session_string IS 'Encrypted MTProto session string for this account';
COMMENT ON COLUMN telegram_accounts.last_flood_until IS 'If set, Telegram FloodWait is active until this timestamp';

ALTER TABLE telegram_channels
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES telegram_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_channels_account
    ON telegram_channels(account_id, is_active, quality_score DESC);

COMMENT ON COLUMN telegram_channels.account_id IS 'Owning Telegram MTProto account (from telegram_accounts) responsible for fetching this channel';

