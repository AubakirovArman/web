-- Авторизация: колонки логина/пароля в app_users.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_key ON app_users(username) WHERE username IS NOT NULL;

-- Пользователи (по ролям) создаются скриптом (пароли хэшируются scrypt):
--   node scripts/seed-auth-users.mjs
-- Требуется переменная окружения AUTH_SECRET (см. .env.local) для подписи сессии.
