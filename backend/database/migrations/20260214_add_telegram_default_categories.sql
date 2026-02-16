-- Migration: Add default Telegram categories (TASK-DHT-021)
-- Adds standard categories for Telegram channels: signals, news, announcements

-- Insert default Telegram categories if they don't exist
INSERT INTO data_categories (name, description, color, icon, created_at, updated_at)
VALUES
    ('signals', 'سیگنال‌های معاملاتی و تحلیل‌های تکنیکال', '#10b981', 'Signal', NOW(), NOW()),
    ('news', 'اخبار و رویدادهای بازار', '#3b82f6', 'News', NOW(), NOW()),
    ('announcements', 'اعلانات و اطلاعیه‌های رسمی', '#f59e0b', 'Announcement', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Add comment
COMMENT ON TABLE data_categories IS 'Data source categories. Default Telegram categories: signals, news, announcements';
