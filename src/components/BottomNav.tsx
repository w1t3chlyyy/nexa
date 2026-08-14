import React from 'react';
import { BarChart3, Gift, User, Zap } from 'lucide-react';
import { sound } from '../utils/sound';

export type TabType = 'sell' | 'market' | 'tasks' | 'profile';

interface BottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  unclaimedTasksCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  unclaimedTasksCount,
}) => {
  const tabs = [
    {
      id: 'sell' as TabType,
      label: 'Продажа',
      icon: Zap,
      badge: null,
    },
    {
      id: 'market' as TabType,
      label: 'Курсы',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'tasks' as TabType,
      label: 'Бонусы',
      icon: Gift,
      badge: unclaimedTasksCount > 0 ? unclaimedTasksCount : null,
    },
    {
      id: 'profile' as TabType,
      label: 'Профиль',
      icon: User,
      badge: null,
    },
  ];

  return (
    <nav
      id="bottom-navigation"
      className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 bg-[#0F0F0F]/95 backdrop-blur-md border-t border-zinc-800/90 px-2 py-1 select-none"
    >
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`tab-btn-${tab.id}`}
              onClick={() => {
                sound.playTap();
                onSelectTab(tab.id);
              }}
              className={`relative flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? 'text-[#A3FF12] font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {/* Active Glow Pill */}
              {isActive && (
                <div className="absolute inset-0 bg-[#1E2514] rounded-xl border border-[#A3FF12]/30"></div>
              )}

              <div className="relative">
                <Icon
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isActive ? 'scale-105 stroke-[2.4]' : 'scale-100 stroke-[1.8]'
                  }`}
                />

                {/* Notification Badge */}
                {tab.badge && (
                  <span className="absolute -top-1 -right-2 bg-[#A3FF12] text-black text-[9px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[10px] mt-0.5 transition-colors ${
                  isActive ? 'text-[#A3FF12] font-bold' : 'text-zinc-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

