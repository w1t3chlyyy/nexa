-- ==============================================================================
-- SUPABASE SCHEMA FOR CRYPTO BOT & MINI APP (USDT SBP CASHOUT SERVICE)
-- Run this script in the Supabase SQL Editor: https://app.supabase.com -> Project -> SQL Editor
-- ==============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'operator', 'owner')),
    tier TEXT NOT NULL DEFAULT 'Bronze' CHECK (tier IN ('Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond')),
    xp INTEGER NOT NULL DEFAULT 0,
    completed_deals INTEGER NOT NULL DEFAULT 0,
    total_volume_rub NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_volume_usd NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    referral_code TEXT UNIQUE,
    referred_by BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast Telegram ID lookup
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 2. REQUISITES TABLE (SBP & Bank details)
CREATE TABLE IF NOT EXISTS public.requisites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_telegram_id BIGINT NOT NULL REFERENCES public.users(telegram_id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'sbp' CHECK (type IN ('sbp', 'card')),
    is_default BOOLEAN NOT NULL DEFAULT false,
    color TEXT NOT NULL DEFAULT '#10b981',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requisites_user_tg ON public.requisites(user_telegram_id);

-- 3. ORDERS TABLE (Payout queue and completed transactions)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT UNIQUE NOT NULL,
    user_telegram_id BIGINT NOT NULL,
    user_username TEXT,
    user_full_name TEXT,
    crypto_symbol TEXT NOT NULL DEFAULT 'USDT',
    crypto_amount NUMERIC(18, 6) NOT NULL,
    fiat_currency TEXT NOT NULL DEFAULT 'RUB',
    fiat_amount NUMERIC(15, 2) NOT NULL,
    rate_used NUMERIC(12, 4) NOT NULL,
    volume_bonus_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    tier_bonus_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    cheque_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'pending', 'paid', 'rejected', 'cancelled')),
    requisite JSONB NOT NULL,
    assigned_admin TEXT,
    paid_at TIMESTAMPTZ,
    payout_tx_id TEXT,
    pdf_receipt JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_tg ON public.orders(user_telegram_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

-- 4. TASKS & CHANNEL SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'telegram_sub' CHECK (category IN ('telegram_sub', 'trade', 'daily', 'milestone', 'referral')),
    reward_xp INTEGER NOT NULL DEFAULT 50,
    reward_usdt NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    max_progress INTEGER NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'канал',
    icon_name TEXT NOT NULL DEFAULT 'Send',
    action_text TEXT NOT NULL DEFAULT 'Подписаться',
    badge TEXT,
    channel_username TEXT,
    channel_title TEXT,
    channel_link TEXT,
    is_channel_sub BOOLEAN NOT NULL DEFAULT false,
    is_required_sub BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. USER COMPLETED TASKS PROGRESS
CREATE TABLE IF NOT EXISTS public.user_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_telegram_id BIGINT NOT NULL,
    task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    progress INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT false,
    claimed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    UNIQUE(user_telegram_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tasks_user ON public.user_tasks(user_telegram_id);

-- 6. TIERS & RATINGS CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS public.tiers_config (
    tier_key TEXT PRIMARY KEY CHECK (tier_key IN ('Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond')),
    title TEXT NOT NULL,
    rate_bonus NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    cashback_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.20,
    min_xp INTEGER NOT NULL DEFAULT 0,
    payout_speed_text TEXT NOT NULL DEFAULT '~ 30 сек',
    color TEXT NOT NULL DEFAULT '#A3FF12',
    icon_name TEXT NOT NULL DEFAULT 'Zap',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ADMINS & OPERATORS TABLE
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('operator', 'admin', 'owner')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================

-- Seed Tier Configs
INSERT INTO public.tiers_config (tier_key, title, rate_bonus, cashback_percent, min_xp, payout_speed_text, color, icon_name)
VALUES
  ('Bronze', 'Бронза', 0.00, 0.20, 0, '~ 60 сек', '#cd7f32', 'Shield'),
  ('Silver', 'Серебро', 0.25, 0.35, 250, '~ 45 сек', '#e2e8f0', 'Sparkles'),
  ('Gold', 'Золото', 0.50, 0.50, 750, '~ 30 сек', '#eab308', 'Crown'),
  ('Platinum', 'Платина', 0.85, 0.75, 2000, '~ 20 сек', '#38bdf8', 'Flame'),
  ('Diamond', 'Бриллиант', 1.20, 1.00, 5000, 'Мгновенно (10 сек)', '#a855f7', 'Diamond')
ON CONFLICT (tier_key) DO UPDATE SET
  title = EXCLUDED.title,
  rate_bonus = EXCLUDED.rate_bonus,
  cashback_percent = EXCLUDED.cashback_percent,
  min_xp = EXCLUDED.min_xp,
  payout_speed_text = EXCLUDED.payout_speed_text,
  color = EXCLUDED.color;

-- Seed Default Tasks
INSERT INTO public.tasks (id, title, description, category, reward_xp, reward_usdt, max_progress, unit, icon_name, action_text, badge, channel_username, channel_title, channel_link, is_channel_sub, is_required_sub, is_active)
VALUES
  ('task_tg_main_channel', 'Обязательная подписка на канал', 'Подпишитесь на официальный канал выплат и курсов сервиса', 'telegram_sub', 150, 0.50, 1, 'канал', 'Send', 'Подписаться', 'Обязательно', '@cryptoex_news', 'CryptoCheque News', 'https://t.me/cryptoex_news', true, true, true),
  ('task_tg_chat', 'Вступить в чат трейдеров', 'Присоединяйтесь к комьюнити сервиса и делитесь отзывами', 'telegram_sub', 100, 0.20, 1, 'чат', 'Users', 'Вступить', 'Чат', '@cryptoex_chat', 'CryptoCheque Community', 'https://t.me/cryptoex_chat', true, false, true),
  ('task_first_usdt_trade', 'Первая продажа чека USDT', 'Создайте и продайте свой первый чек USDT через СБП', 'trade', 100, 0.50, 1, 'сделка', 'Zap', 'Продать чек', 'Старт', NULL, NULL, NULL, false, false, true),
  ('task_volume_500', 'Объем продаж от $500 USDT', 'Совершите обмен чеков на суммарный объем более 500 USDT', 'milestone', 250, 1.50, 500, 'USDT', 'Award', 'К обмену', 'Крупный объем', NULL, NULL, NULL, false, false, true)
ON CONFLICT (id) DO NOTHING;

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_users ON public.users;
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_orders ON public.orders;
CREATE TRIGGER set_timestamp_orders
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiers_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Allow public read of tasks & tiers_config
CREATE POLICY "Public tasks are viewable by everyone" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Public tiers are viewable by everyone" ON public.tiers_config FOR SELECT USING (true);
CREATE POLICY "Service role full access on all tables" ON public.users FOR ALL USING (true);
CREATE POLICY "Service role full access on orders" ON public.orders FOR ALL USING (true);
CREATE POLICY "Service role full access on requisites" ON public.requisites FOR ALL USING (true);
CREATE POLICY "Service role full access on tasks" ON public.tasks FOR ALL USING (true);
CREATE POLICY "Service role full access on user_tasks" ON public.user_tasks FOR ALL USING (true);
CREATE POLICY "Service role full access on admins" ON public.admins FOR ALL USING (true);
