import React from 'react';
import { ShieldCheck, Sparkles, Volume2, VolumeX, Star, MoreVertical, X, Bot, Lock } from 'lucide-react';
import { UserStats, TierInfo } from '../types';
import { sound } from '../utils/sound';
import { CryptoNexaLogo } from './CryptoNexaLogo';

interface TelegramHeaderProps {
  user: UserStats;
  tier: TierInfo;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenProfile: () => void;
  onOpenTelegramBot?: () => void;
}

export const TelegramHeader: React.FC<TelegramHeaderProps> = ({
  user,
  tier,
  soundEnabled,
  onToggleSound,
  onOpenProfile,
  onOpenTelegramBot,
}) => {
  const [time, setTime] = React.useState('18:45');

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header id="telegram-header" className="w-full bg-[#141414]/95 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-40 select-none">
      {/* Telegram Status Bar */}
     
      {/* Brand Bar */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CryptoNexaLogo className="w-8 h-8" rounded="rounded-xl" />

          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-black tracking-tight text-white uppercase font-mono">
                Crypto<span className="text-[#A3FF12]">Nexa</span>
              </h1>
              <span className="text-[9px] font-bold bg-zinc-800 text-zinc-400 px-1 py-0.2 rounded uppercase">
                TMA
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A3FF12]"></span>
              Быстрый обмен USDT
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Bot shortcut */}
          {onOpenTelegramBot && (
            <button
              id="header-open-bot-btn"
              onClick={() => {
                sound.playTap();
                onOpenTelegramBot();
              }}
              title="Открыть чат с ботом в Telegram"
              className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[#A3FF12] border border-zinc-700/60 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            id="sound-toggle-btn"
            onClick={() => {
              sound.playTap();
              onToggleSound();
            }}
            title={soundEnabled ? 'Звук включен' : 'Звук выключен'}
            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-[#A3FF12] border border-zinc-700/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#A3FF12]" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* User Status Bar */}
      <div className="px-4 pb-2">
        <div
          onClick={() => {
            sound.playTap();
            onOpenProfile();
          }}
          className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800/80 border border-zinc-800 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full border border-[#A3FF12]/70 p-0.5 flex-shrink-0 relative">
              <img
                src={user.avatarUrl}
                alt={user.fullName}
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-full object-cover"
              />
              {user.isPremium && (
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-black border border-[#A3FF12] rounded-full flex items-center justify-center">
                  <Star className="w-1.5 h-1.5 text-[#A3FF12] fill-[#A3FF12]" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-white truncate group-hover:text-[#A3FF12] transition-colors">
                  @{user.username}
                </span>
                {user.isVerified && (
                  <ShieldCheck className="w-3 h-3 text-[#A3FF12] flex-shrink-0" />
                )}
              </div>
              <p className="text-[10px] text-zinc-400">
                {tier.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono">
              <ShieldCheck className="w-3 h-3 text-[#A3FF12]" />
              <span className="font-bold text-white">{user.completedDeals}</span>
            </div>

            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[#1E2514] border border-[#A3FF12]/30 text-[#A3FF12] text-[11px] font-bold">
              <Sparkles className="w-2.5 h-2.5" />
              <span>+{tier.rateBonus}%</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
