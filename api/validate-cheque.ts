import type { VercelRequest, VercelResponse } from '@vercel/node';

interface CryptoBotCheck {
  check_id: number;
  hash: string;
  asset: string;
  amount: string;
  bot_check_url: string;
  status: 'active' | 'activated';
}

function extractCode(raw: string): string {
  const input = raw.trim();
  const match = input.match(/start=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  const parts = input.split('/');
  return parts[parts.length - 1];
}

// ВАЖНО: публичный Crypto Pay API CryptoBot не умеет проверять ЛЮБОЙ чужой чек
// по коду. Метод getChecks возвращает только чеки, созданные ВАШИМ ЖЕ
// приложением CryptoBot. Поэтому эта проверка реально работает только для
// чеков, выпущенных через ваш собственный аккаунт CryptoBot.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { code } = req.body || {};
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ ok: false, error: 'Не передан код чека' });
  }

  const token = process.env.CRYPTOBOT_API_TOKEN;
  if (!token) {
    return res.status(500).json({ ok: false, error: 'CRYPTOBOT_API_TOKEN не настроен на сервере' });
  }

  const extracted = extractCode(code);

  try {
    const resp = await fetch('https://pay.crypt.bot/api/getChecks?status=active&count=1000', {
      headers: { 'Crypto-Pay-API-Token': token },
    });
    const data = await resp.json();

    if (!data.ok) {
      return res.status(502).json({ ok: false, error: data.error?.name || 'Ошибка CryptoBot API' });
    }

    const checks: CryptoBotCheck[] = data.result || [];
    const found = checks.find(
      (c) => c.hash === extracted || c.bot_check_url?.includes(extracted)
    );

    if (!found) {
      return res.status(200).json({
        ok: false,
        error: 'Чек не найден или уже активирован. Проверьте ссылку/код.',
      });
    }

    return res.status(200).json({
      ok: true,
      checkId: found.check_id,
      asset: found.asset,
      amount: found.amount,
      status: found.status,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message || 'Ошибка проверки чека' });
  }
}
