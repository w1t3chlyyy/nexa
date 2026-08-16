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
    { id: 'sell' as TabType, label: 'Продажа', icon: Zap, badge: null },
    { id: 'market' as TabType, label: 'Курсы', icon: BarChart3, badge: null },
    { id: 'tasks' as TabType, label: 'Бонусы', icon: Gift, badge: unclaimedTasksCount > 0 ? unclaimedTasksCount : null },
    { id: 'profile' as TabType, label: 'Профиль', icon: User, badge: null },
  ];

  return (
    <nav
      id="bottom-navigation"
      className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 bg-[#0A0A0B]/95 backdrop-blur-md border-t border-zinc-900 px-2 py-2 select-none"
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
              className="relative flex flex-col items-center justify-center flex-1 py-1 gap-1 cursor-pointer"
            >
              <div className="relative">
                <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-zinc-600'}`} strokeWidth={isActive ? 2.2 : 1.8} />
                {tab.badge && (
                  <span className="absolute -top-1 -right-1.5 bg-[#A3FF12] text-black text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] ${isActive ? 'text-white font-medium' : 'text-zinc-600'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
