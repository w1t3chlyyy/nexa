export function getTelegramUser() {
  const tg = (window as any).Telegram?.WebApp;
  tg?.ready?.();
  const user = tg?.initDataUnsafe?.user;
  if (!user) return null;
  return {
    id: String(user.id),
    username: user.username || `user${user.id}`,
    fullName: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Пользователь',
    avatarUrl: user.photo_url || 'https://ui-avatars.com/api/?name=' + (user.first_name || 'U'),
    isPremium: !!user.is_premium,
  };
}
