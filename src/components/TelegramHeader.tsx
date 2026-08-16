import React from 'react';
import { Volume2, VolumeX, Bot } from 'lucide-react';
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
  return (
    <header id="telegram-header" className="w-full bg-[#0A0A0B]/95 backdrop-blur-md border-b border-zinc-900 sticky top-0 z-40 select-none">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CryptoNexaLogo className="w-7 h-7" rounded="rounded-lg" />
          <div>
            <h1 className="text-sm font-semibold text-white">CryptoNexa</h1>
            <p className="text-[11px] text-zinc-500">Обмен USDT · СБП</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onOpenTelegramBot && (
            <button
              onClick={() => {
                sound.playTap();
                onOpenTelegramBot();
              }}
              title="Открыть чат с ботом"
              className="w-8 h-8 rounded-lg text-zinc-500 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <Bot className="w-4 h-4" />
            </button>
          )}
          <button
            id="sound-toggle-btn"
            onClick={() => {
              sound.playTap();
              onToggleSound();
            }}
            title={soundEnabled ? 'Звук включен' : 'Звук выключен'}
            className="w-8 h-8 rounded-lg text-zinc-500 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="px-4 pb-3">
        <button
          onClick={() => {
            sound.playTap();
            onOpenProfile();
          }}
          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#141415] hover:bg-zinc-900 border border-zinc-800/70 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={user.avatarUrl}
              alt={user.fullName}
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
            />
            <div className="min-w-0 text-left">
              <div className="text-xs font-medium text-white truncate">@{user.username}</div>
              <p className="text-[11px] text-zinc-500">{tier.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono flex-shrink-0">
            <span className="text-zinc-500">{user.completedDeals} сделок</span>
            <span className="text-[#A3FF12]">+{tier.rateBonus}%</span>
          </div>
        </button>
      </div>
    </header>
  );
};
