import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Crown,
  Sparkles,
  Gift,
  Flame,
  Award,
  Zap,
  CheckCircle2,
  ChevronRight,
  Coins,
  Send,
  Bot,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { UserStats, TierInfo, QuestTask, RatingTier, QuestCategory } from '../types';
import { TIERS } from '../data/mockData';
import { sound } from '../utils/sound';

interface TasksAndBonusesViewProps {
  user: UserStats;
  tier: TierInfo;
  tasks: QuestTask[];
  onClaimTask: (taskId: string) => void;
  onClaimDailyStreak: () => void;
  onNavigateToSell: () => void;
  onVerifyTelegramTask: (taskId: string, channelName?: string) => Promise<boolean>;
}

export const TasksAndBonusesView: React.FC<TasksAndBonusesViewProps> = ({
  user,
  tier,
  tasks,
  onClaimTask,
  onClaimDailyStreak,
  onNavigateToSell,
  onVerifyTelegramTask,
}) => {
  const [activeCategory, setActiveCategory] = useState<QuestCategory | 'all'>('all');
  const [selectedTierDetail, setSelectedTierDetail] = useState<RatingTier>(user.tier);
  const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null);
  const [channelInputs, setChannelInputs] = useState<Record<string, string>>({
    task_add_bot_admin: '@my_trading_channel',
  });
  const [verificationError, setVerificationError] = useState<Record<string, string>>({});

  const filteredTasks = tasks.filter((t) => {
    if (activeCategory === 'all') return true;
    return t.category === activeCategory;
  });

  const xpPercent = Math.min(100, Math.round((user.xp / user.xpToNextTier) * 100));

  const streakDays = [
    { day: 1, reward: '+10 XP', claimed: true },
    { day: 2, reward: '+15 XP', claimed: true },
    { day: 3, reward: '+20 XP', claimed: true },
    { day: 4, reward: '+30 XP + $0.5', isToday: true, claimed: user.streakClaimedToday },
    { day: 5, reward: '+40 XP', claimed: false },
    { day: 6, reward: '+50 XP', claimed: false },
    { day: 7, reward: 'VIP + $2', isSpecial: true, claimed: false },
  ];

  const handleClaimStreak = () => {
    if (user.streakClaimedToday) return;
    sound.playLevelUp();
    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.5 },
        colors: ['#a3e635', '#bef264', '#facc15'],
      });
    } catch {
      // Ignore
    }
    onClaimDailyStreak();
  };

  const handleTaskClick = async (task: QuestTask) => {
    if (task.completed && !task.claimed) {
      sound.playLevelUp();
      try {
        confetti({
          particleCount: 70,
          spread: 65,
          origin: { y: 0.6 },
          colors: ['#a3e635', '#38bdf8', '#c084fc'],
        });
      } catch {
        // Ignore
      }
      onClaimTask(task.id);
      return;
    }

    if (task.isChannelSub || task.category === 'telegram_sub') {
      sound.playTap();
      setVerifyingTaskId(task.id);
      setVerificationError((prev) => ({ ...prev, [task.id]: '' }));

      const customChannel = channelInputs[task.id] || task.channelUsername || '@my_channel';
      
      const success = await onVerifyTelegramTask(task.id, customChannel);
      setVerifyingTaskId(null);

      if (success) {
        sound.playSuccess();
        try {
          confetti({
            particleCount: 75,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#a3e635', '#bef264', '#38bdf8'],
          });
        } catch {
          // Ignore
        }
      } else {
        sound.playTap();
        setVerificationError((prev) => ({
          ...prev,
          [task.id]: 'Не удалось подтвердить. Убедитесь, что вы подписались или добавили бота администратором.',
        }));
      }
      return;
    }

    if (!task.completed) {
      sound.playTap();
      onNavigateToSell();
    }
  };

  return (
    <div id="tasks-bonuses-view" className="space-y-3 pb-20 select-none">
      {/* Tier Status & XP Header Card */}
      <div className="p-4 rounded-2xl bg-[#181818] border border-zinc-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1E2514] border border-[#A3FF12]/40 flex items-center justify-center text-[#A3FF12]">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">{tier.title}</h2>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#1E2514] border border-[#A3FF12]/30 text-[#A3FF12]">
                  +{tier.rateBonus}%
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Выплат: <strong className="text-white font-mono">{user.completedDeals}</strong> • <span className="text-[#A3FF12] font-semibold">СБП 0%</span>
              </p>
            </div>
          </div>

          <div className="text-right font-mono">
            <span className="text-[10px] text-zinc-400">XP</span>
            <div className="text-xs font-bold text-white">
              {user.xp} <span className="text-zinc-500 font-normal">/ {user.xpToNextTier}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1 font-semibold">
            <span className="text-zinc-400">До следующего ранга</span>
            <span className="text-[#A3FF12] font-mono">{xpPercent}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
            <div
              className="h-full rounded-full bg-[#A3FF12] transition-all duration-500"
              style={{ width: `${xpPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Privileges */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#A3FF12] flex-shrink-0" />
            <span className="text-zinc-300 text-[11px]">Курс: <strong className="text-white">+{tier.rateBonus}%</strong></span>
          </div>
          <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-[#A3FF12] flex-shrink-0" />
            <span className="text-zinc-300 text-[11px]">Кэшбэк: <strong className="text-white">{tier.cashbackPercent}%</strong> USDT</span>
          </div>
        </div>
      </div>

      {/* Daily Streak Card */}
      <div className="p-3.5 rounded-2xl bg-[#181818] border border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <h3 className="text-xs font-bold text-white">
              Ежедневный вход
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-[#A3FF12]">
            {user.streakDays} дня подряд
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {streakDays.map((s) => (
            <div
              key={s.day}
              className={`p-1 rounded-xl border text-center flex flex-col items-center justify-between min-h-[56px] ${
                s.claimed
                  ? 'bg-[#1E2514] border-[#A3FF12]/40 text-[#A3FF12]'
                  : s.isToday
                  ? 'bg-zinc-900 border-[#A3FF12] text-white'
                  : 'bg-zinc-900/50 border-zinc-800 text-zinc-500'
              }`}
            >
              <span className="text-[9px] font-mono">Д{s.day}</span>
              <div className="my-0.5">
                {s.claimed ? (
                  <CheckCircle2 className="w-3 h-3 text-[#A3FF12] mx-auto" />
                ) : (
                  <Gift className={`w-3 h-3 mx-auto ${s.isSpecial ? 'text-[#A3FF12]' : 'text-zinc-400'}`} />
                )}
              </div>
              <span className="text-[8px] font-mono leading-tight">{s.reward}</span>
            </div>
          ))}
        </div>

        <button
          id="claim-daily-streak-btn"
          type="button"
          disabled={user.streakClaimedToday}
          onClick={handleClaimStreak}
          className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            user.streakClaimedToday
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
              : 'bg-[#A3FF12] hover:bg-[#b2ff33] text-black cursor-pointer'
          }`}
        >
          {user.streakClaimedToday ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
              <span>Бонус дня получен</span>
            </>
          ) : (
            <>
              <Flame className="w-3.5 h-3.5" />
              <span>Забрать награду (+30 XP и $0.5)</span>
            </>
          )}
        </button>
      </div>

      {/* Rating Tier Privileges Showcase */}
      <div className="p-3.5 rounded-2xl bg-[#181818] border border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-[#A3FF12]" />
            <h3 className="text-xs font-bold text-white">
              Ранги и надбавки
            </h3>
          </div>
        </div>

        {/* Tier Selector Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {Object.keys(TIERS).map((tierKey) => {
            const t = TIERS[tierKey];
            const isCurrent = user.tier === t.tier;
            const isSelected = selectedTierDetail === t.tier;
            return (
              <button
                key={t.tier}
                onClick={() => {
                  sound.playTap();
                  setSelectedTierDetail(t.tier);
                }}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? 'bg-zinc-900 border-[#A3FF12] text-[#A3FF12]'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }}></span>
                <span>{t.title.split(' ')[0]}</span>
                {isCurrent && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-[#A3FF12] text-black font-black">
                    Вы
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Tier Perks Box */}
        {(() => {
          const detail = TIERS[selectedTierDetail] || TIERS.Gold;
          return (
            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                <div className="flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5" style={{ color: detail.color }} />
                  <span className="text-xs font-bold text-white">{detail.title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-bold text-[#A3FF12]">+{detail.rateBonus}% к курсу</span>
                  <span className="text-[10px] text-zinc-500 font-mono">({detail.minXp} XP)</span>
                </div>
              </div>

              <div className="space-y-1 pt-0.5">
                {detail.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                    <CheckCircle2 className="w-3 h-3 text-[#A3FF12] flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Tasks & Quests Section */}
      <div className="p-3.5 rounded-2xl bg-[#181818] border border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5 text-[#A3FF12]" />
            <h3 className="text-xs font-bold text-white">
              Задания
            </h3>
          </div>
          <span className="text-[11px] text-zinc-400 font-mono">
            {tasks.filter((t) => t.completed && !t.claimed).length} к получению
          </span>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {[
            { id: 'all', label: 'Все' },
            { id: 'daily', label: 'Ежедневные' },
            { id: 'trade', label: 'После обмена' },
            { id: 'telegram_sub', label: 'Каналы/Боты' },
            { id: 'milestone', label: 'Оборот' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                sound.playTap();
                setActiveCategory(cat.id as any);
              }}
              className={`px-2.5 py-0.5 text-[11px] font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-[#A3FF12] text-black'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Tasks List */}
        <div className="space-y-2">
          {filteredTasks.map((task) => {
            const isReadyToClaim = task.completed && !task.claimed;
            const isClaimed = task.claimed;
            const isVerifying = verifyingTaskId === task.id;
            const err = verificationError[task.id];

            return (
              <div
                key={task.id}
                id={`task-item-${task.id}`}
                className={`p-3 rounded-xl border transition-all ${
                  isReadyToClaim
                    ? 'bg-[#1E2514] border-[#A3FF12]/60'
                    : isClaimed
                    ? 'bg-zinc-900/30 border-zinc-800/60 opacity-60'
                    : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-white">{task.title}</span>
                      {task.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-[#A3FF12] border border-zinc-700">
                          {task.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                      {task.description}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0 font-mono">
                    <span className="text-xs font-bold text-[#A3FF12]">
                      +{task.rewardXp} XP
                    </span>
                    {task.rewardUsdt && (
                      <div className="text-[10px] font-bold text-zinc-300">+${task.rewardUsdt} USDT</div>
                    )}
                  </div>
                </div>

                {/* Special UI for Telegram Bot Admin / Channel Subscription */}
                {task.category === 'telegram_sub' && !isClaimed && !task.completed && (
                  <div className="my-2 p-2 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5">
                    {task.isCustomChannel ? (
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-semibold mb-1">
                          Канал/чат:
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={channelInputs[task.id] || ''}
                            onChange={(e) =>
                              setChannelInputs((prev) => ({
                                ...prev,
                                [task.id]: e.target.value,
                              }))
                            }
                            placeholder="@channel"
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white font-mono focus:border-[#A3FF12] outline-none"
                          />
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                          <Bot className="w-3 h-3 text-[#A3FF12]" />
                          <span>Бот: <strong className="text-white">@CryptoBotCash_bot</strong> (админ)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1 text-zinc-300 text-[11px]">
                          <Send className="w-3 h-3 text-[#A3FF12]" />
                          <span>Канал: <strong className="text-white">{task.channelUsername}</strong></span>
                        </div>
                        <a
                          href={`https://t.me/${task.channelUsername?.replace('@', '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold text-[#A3FF12] hover:underline inline-flex items-center gap-0.5"
                        >
                          Открыть <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    )}

                    {err && (
                      <div className="text-[11px] text-rose-400 font-medium">
                        {err}
                      </div>
                    )}
                  </div>
                )}

                {/* Progress bar and Action button */}
                <div className="flex items-center justify-between gap-2.5 pt-1.5 border-t border-zinc-800/60">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5 font-mono">
                      <span>Прогресс</span>
                      <span className="text-zinc-200">
                        {Math.min(task.progress, task.maxProgress)} / {task.maxProgress} {task.unit}
                      </span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-zinc-950 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#A3FF12]"
                        style={{
                          width: `${Math.min(100, (task.progress / task.maxProgress) * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={() => handleTaskClick(task)}
                    className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                      isVerifying
                        ? 'bg-zinc-800 text-zinc-400 cursor-wait'
                        : isReadyToClaim
                        ? 'bg-[#A3FF12] hover:bg-[#b2ff33] text-black'
                        : isClaimed
                        ? 'bg-zinc-800 text-zinc-500 cursor-default'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                    }`}
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin text-[#A3FF12]" />
                        <span>Проверка...</span>
                      </>
                    ) : isReadyToClaim ? (
                      <>
                        <Sparkles className="w-3 h-3" />
                        <span>Забрать</span>
                      </>
                    ) : isClaimed ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-[#A3FF12]" />
                        <span>Получено</span>
                      </>
                    ) : (
                      <>
                        <span>{task.actionText}</span>
                        <ChevronRight className="w-3 h-3" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};


