import React, { useEffect, useState } from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { TierInfo, Banner } from '../types';
import { SUPPORTED_CRYPTOS } from '../data/mockData';
import { supabase } from '../lib/supabase';
import { sound } from '../utils/sound';

interface HomeViewProps {
  tier: TierInfo;
  onNavigateToSell: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ tier, onNavigateToSell }) => {
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    console.log('🏠 HomeView mount, supabase:', supabase ? '✅ есть' : '❌ null');

    if (!supabase) {
      console.warn('❌ Supabase не инициализирован — проверь lib/supabase.ts и env-переменные');
      return;
    }

    (async () => {
      console.log('📡 Отправляю запрос banners...');
      
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      console.log('📊 Banners result:', { data, error, count: data?.length });

      if (error) {
        console.error('❌ Banners error:', error);
        return;
      }

      if (data) {
        console.log('✅ Banners loaded:', data.length, 'шт.');
        setBanners(data as Banner[]);
      } else {
        console.log('⚠️ Banners data is null/undefined');
      }
    })();
  }, []);

  const smallBanners = banners.filter((b) => b.size === 'small');
  const largeBanners = banners.filter((b) => b.size === 'large');

  const currentCrypto = SUPPORTED_CRYPTOS[0];
  const effectiveRate = Number((currentCrypto.priceRub * (1 + tier.rateBonus / 100)).toFixed(2));

  console.log('💱 Рендер: effectiveRate =', effectiveRate, 'priceRub =', currentCrypto.priceRub, 'bonus =', tier.rateBonus);

  const openLink = (url: string) => {
    sound.playTap();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div id="home-view" className="space-y-4 pb-28 select-none">
      {smallBanners.length > 0 && (
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar">
          {smallBanners.map((b) => (
            <button
              key={b.id}
              onClick={() => openLink(b.link_url)}
              className="flex-shrink-0 w-20 flex flex-col items-center gap-1.5 cursor-pointer"
            >
              <div className="w-20 h-20 rounded-2xl overflow-hidden border border-zinc-800 bg-[#141415]">
                <img src={b.image_url} alt={b.title} className="w-full h-full object-cover" />
              </div>
              <span className="text-[10px] text-zinc-400 text-center leading-tight line-clamp-2">{b.title}</span>
            </button>
          ))}
        </div>
      )}

      {smallBanners.length === 0 && (
        <div className="text-xs text-zinc-600 text-center py-2">
          📭 Маленькие баннеры не загружены (count: 0)
        </div>
      )}

      <div className="p-6 rounded-2xl bg-[#141415] border border-zinc-800/70 text-center space-y-1">
        <div className="text-xs text-zinc-500">Курс USDT</div>
        <div className="text-4xl font-semibold text-white">{effectiveRate} ₽</div>
        <div className="text-xs text-zinc-600">1 USDT = {effectiveRate} ₽ · бонус +{tier.rateBonus}%</div>

        <button
          onClick={() => {
            sound.playTap();
            onNavigateToSell();
          }}
          className="w-full mt-4 py-3.5 rounded-xl bg-[#A3FF12] hover:bg-[#b2ff33] text-black text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <span>Создать обмен</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {largeBanners.length > 0 && (
        <div className="space-y-3">
          {largeBanners.map((b) => (
            <button
              key={b.id}
              onClick={() => openLink(b.link_url)}
              className="relative w-full rounded-2xl overflow-hidden border border-zinc-800/70 aspect-[2/1] cursor-pointer group"
            >
              <img src={b.image_url} alt={b.title} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between">
                <span className="text-sm font-semibold text-white text-left leading-tight">{b.title}</span>
                <span className="flex items-center gap-1 text-xs text-white bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-full flex-shrink-0">
                  Перейти <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {largeBanners.length === 0 && (
        <div className="text-xs text-zinc-600 text-center py-2">
          📭 Большие баннеры не загружены (count: 0)
        </div>
      )}
    </div>
  );
};
