import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const botToken = process.env.BOT_TOKEN;
  const host = req.headers.host || process.env.VERCEL_URL;
  const proto = req.headers['x-forwarded-proto'] || 'https';

  if (!botToken) {
    return res.status(400).json({ error: 'BOT_TOKEN is not configured' });
  }

  const webhookUrl = `${proto}://${host}/api/webhook`;
  const tgUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;

  try {
    const response = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
      }),
    });

    const data = await response.json();
    return res.status(200).json({
      success: true,
      webhook_url: webhookUrl,
      telegram_response: data,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
