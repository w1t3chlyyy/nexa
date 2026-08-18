import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Flame,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { UserStats, TierInfo, QuestTask, RatingTier, QuestCategory } from '../types';
import { sound } from '../utils/sound';

interface TasksAndBonusesViewProps {
  user: UserStats;
  tier: TierInfo;
  tiers: Record<string, TierInfo>;
  tasks: QuestTask[];
  onClaimTask: (taskId: string) => void;
  onClaimDailyStreak: () => void;
  onNavigateToSell: () => void;
  onVerifyTelegramTask: (taskId: string, channelName?: string) => Promise<boolean>;
}

const CATEGORY_LABELS: { id: QuestCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'daily', label: 'Ежедневные' },
  { id: 'trade', label: 'После обмена' },
  { id: 'telegram_sub', label: 'Каналы' },
  { id: 'milestone', label: 'Вехи' },
];

export const TasksAndBonusesView: React.FC<TasksAndBonusesViewProps> = ({
  user,
  tier,
  tiers,
  tasks,
  onClaimTask,
  onClaimDailyStreak,
  onNavigateToSell,
  onVerifyTelegramTask,
}) => {
  const [activeCategory, setActiveCategory] = useState<QuestCategory | 'all'>('all');
  const [selectedTierDetail, setSelectedTierDetail] = useState<RatingTier>(user.tier);
  const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<Record<string, string>>({});

  const filteredTasks = tasks.filter((t) => activeCategory === 'all' || t.category === activeCategory);
  const xpPercent = Math.min(100, Math.round((user.xp / user.xpToNextTier) * 100));
  const tierKeys = Object.keys(tiers);

  const handleClaimStreak = () => {
    if (user.streakClaimedToday) return;
    sound.playLevelUp();
    try {
      confetti({ particleCount: 50, spread: 55, origin: { y: 0.5 }, colors: ['#a3e635', '#ffffff'] });
    } catch {
      // ignore
    }
    onClaimDailyStreak();
  };

  const handleTaskClick = async (task: QuestTask) => {
    if (task.completed && !task.claimed) {
      sound.playLevelUp();
      try {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 }, colors: ['#a3e635', '#ffffff'] });
      } catch {
        // ignore
      }
      onClaimTask(task.id);
      return;
    }

    if (task.isChannelSub || task.category === 'telegram_sub') {
      sound.playTap();
      setVerifyingTaskId(task.id);
      setVerificationError((prev) => ({ ...prev, [task.id]: '' }));

      const success = await onVerifyTelegramTask(task.id, task.channelUsername);
      setVerifyingTaskId(null);

      if (success) {
        sound.playSuccess();
      } else {
        setVerificationError((prev) => ({
          ...prev,
          [task.id]: 'Не удалось подтвердить подписку.',
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
    <div id="tasks-bonuses-view" className="space-y-3 pb-28 select-none">
      {/* Ранг и XP */}
      <div className="p-5 rounded-2xl bg-[#141415] border border-zinc-800/70 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">{tier.title}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{user.completedDeals} выплат · +{tier.rateBonus}% к курсу</p>
          </div>
          <div className="text-right text-xs font-mono text-zinc-500">
            {user.xp} / {user.xpToNextTier} XP
          </div>
        </div>

        <div className="w-full h-1 rounded-full bg-zinc-900 overflow-hidden">
          <div className="h-full rounded-full bg-[#A3FF12] transition-all duration-500" style={{ width: `${xpPercent}%` }} />
        </div>
      </div>

      {/* Ежедневный стрик */}
      <div className="p-5 rounded-2xl bg-[#141415] border border-zinc-800/70 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-medium text-white">Ежедневный вход</h3>
          </div>
          <span className="text-xs font-mono text-zinc-500">{user.streakDays} дня подряд</span>
        </div>

        <button
          id="claim-daily-streak-btn"
          type="button"
          disabled={user.streakClaimedToday}
          onClick={handleClaimStreak}
          className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
            user.streakClaimedToday
              ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
              : 'bg-[#A3FF12] hover:bg-[#b2ff33] text-black'
          }`}
        >
          {user.streakClaimedToday ? 'Бонус дня получен' : 'Забрать награду (+30 XP, +$0.5)'}
        </button>
      </div>

      {/* Ранги (динамически из Supabase tiers_config, редактируются в боте) */}
      {tierKeys.length > 0 && (
        <div className="p-5 rounded-2xl bg-[#141415] border border-zinc-800/70 space-y-3">
          <h3 className="text-sm font-medium text-white">Ранги и надбавки</h3>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {tierKeys.map((tierKey) => {
              const t = tiers[tierKey];
              const isCurrent = user.tier === t.tier;
              const isSelected = selectedTierDetail === t.tier;
              return (
                <button
                  key={t.tier}
                  onClick={() => {
                    sound.playTap();
                    setSelectedTierDetail(t.tier);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap transition-colors cursor-pointer ${
                    isSelected ? 'bg-zinc-100 text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  {t.title.split(' ')[0]}
                  {isCurrent && ' · вы'}
                </button>
              );
            })}
          </div>

          {(() => {
            const detail = tiers[selectedTierDetail] || tiers[tierKeys[0]];
            if (!detail) return null;
            return (
              <div className="pt-2 border-t border-zinc-800 space-y-1.5">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-white">{detail.title}</span>
                  <span className="text-[#A3FF12] font-mono text-xs">+{detail.rateBonus}%</span>
                </div>
                {detail.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-zinc-400">
                    <CheckCircle2 className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Задания (динамически из Supabase tasks, редактируются в боте) */}
      <div className="p-5 rounded-2xl bg-[#141415] border border-zinc-800/70 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Задания</h3>
          <span className="text-xs text-zinc-500 font-mono">
            {tasks.filter((t) => t.completed && !t.claimed).length} к получению
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {CATEGORY_LABELS.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                sound.playTap();
                setActiveCategory(cat.id as any);
              }}
              className={`px-2.5 py-1 text-xs rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeCategory === cat.id ? 'bg-zinc-100 text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {filteredTasks.length === 0 ? (
          <div className="text-center text-xs text-zinc-600 py-6">Заданий пока нет.</div>
        ) : (
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
                  className={`p-3.5 rounded-xl border transition-colors ${
                    isClaimed ? 'border-zinc-900 opacity-50' : 'border-zinc-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white">{task.title}</div>
                      <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{task.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0 text-xs font-mono">
                      <div className="text-[#A3FF12]">+{task.rewardXp} XP</div>
                      {task.rewardUsdt ? <div className="text-zinc-500">+${task.rewardUsdt}</div> : null}
                    </div>
                  </div>

                  {task.category === 'telegram_sub' && !isClaimed && !task.completed && task.channelUsername && (
                    <div className="mt-2.5 pt-2.5 border-t border-zinc-800/70 flex items-center justify-between text-xs">
                      <span className="text-zinc-500">{task.channelUsername}</span>
                      {task.channelLink && (
                        <a
                          href={task.channelLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-zinc-400 hover:text-white inline-flex items-center gap-1"
                        >
                          Открыть <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}

                  {err && <div className="text-xs text-rose-400 mt-1.5">{err}</div>}

                  <div className="mt-2.5 pt-2.5 border-t border-zinc-800/70 flex items-center justify-between gap-2.5">
                    <div className="flex-1">
                      <div className="w-full h-1 rounded-full bg-zinc-900 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-zinc-600"
                          style={{ width: `${Math.min(100, (task.progress / task.maxProgress) * 100)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-1">
                        {Math.min(task.progress, task.maxProgress)} / {task.maxProgress} {task.unit}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isVerifying || isClaimed}
                      onClick={() => handleTaskClick(task)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isVerifying
                          ? 'bg-zinc-900 text-zinc-500 cursor-wait'
                          : isReadyToClaim
                          ? 'bg-[#A3FF12] hover:bg-[#b2ff33] text-black'
                          : isClaimed
                          ? 'bg-transparent text-zinc-600 cursor-default'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                      }`}
                    >
                      {isVerifying ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Проверка</span>
                        </>
                      ) : isReadyToClaim ? (
                        'Забрать'
                      ) : isClaimed ? (
                        'Получено'
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
        )}
      </div>
    </div>
  );
};
