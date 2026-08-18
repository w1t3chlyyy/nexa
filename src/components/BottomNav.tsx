import React from 'react';
import { Home, Zap, BarChart3, Gift, User } from 'lucide-react';
import { sound } from '../utils/sound';

export type TabType = 'home' | 'sell' | 'market' | 'tasks' | 'profile';

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
    { id: 'home' as TabType, icon: Home, badge: null },
    { id: 'sell' as TabType, icon: Zap, badge: null },
    { id: 'market' as TabType, icon: BarChart3, badge: null },
    { id: 'tasks' as TabType, icon: Gift, badge: unclaimedTasksCount > 0 ? unclaimedTasksCount : null },
    { id: 'profile' as TabType, icon: User, badge: null },
  ];

  return (
    <nav
      id="bottom-navigation"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-[380px] bg-white/[0.06] backdrop-blur-2xl border border-white/10 rounded-full shadow-2xl shadow-black/40 px-2 py-2 select-none"
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
              className="relative flex items-center justify-center w-11 h-11 rounded-full cursor-pointer transition-colors"
            >
              {isActive && <div className="absolute inset-0 rounded-full bg-white/10" />}
              <div className="relative">
                <Icon
                  className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-zinc-500'}`}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2 bg-[#A3FF12] text-black text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
