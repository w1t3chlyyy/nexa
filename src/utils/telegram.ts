export interface TelegramUserData {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string;
  isPremium: boolean;
}

export function getTelegramUser(): TelegramUserData | null {
  const tg = (window as any).Telegram?.WebApp;
  tg?.ready?.();
  tg?.expand?.();

  const user = tg?.initDataUnsafe?.user;
  if (!user) return null;

  return {
    id: String(user.id),
    username: user.username || `user${user.id}`,
    fullName: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Пользователь',
    avatarUrl:
      user.photo_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name || 'U')}&background=A3FF12&color=000`,
    isPremium: !!user.is_premium,
  };
}

// Достаём initData целиком — понадобится, чтобы бэкенд мог проверить
// подлинность пользователя (Telegram подписывает initData секретом бота)
export function getTelegramInitData(): string {
  return (window as any).Telegram?.WebApp?.initData || '';
}
