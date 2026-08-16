import React, { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { TierInfo, CryptoSymbol } from '../types';
import { SUPPORTED_CRYPTOS, VOLUME_TIERS } from '../data/mockData';
import { sound } from '../utils/sound';

interface MarketViewProps {
  tier: TierInfo;
  onQuickSell: (symbol: CryptoSymbol) => void;
}

export const MarketView: React.FC<MarketViewProps> = ({ tier, onQuickSell }) => {
  const [calcAmount, setCalcAmount] = useState<string>('100');

  const currentCrypto = SUPPORTED_CRYPTOS[0]; // USDT
  const parsedAmount = parseFloat(calcAmount) || 0;
  const tierMultiplier = 1 + tier.rateBonus / 100;
  const effectiveRubRate = currentCrypto.priceRub * tierMultiplier;
  const calculatedRub = (parsedAmount * effectiveRubRate).toFixed(2);

  const presetAmounts = [25, 50, 100, 300, 500, 1000];

  return (
    <div id="market-view" className="space-y-3 pb-24 select-none">
      <div className="p-5 rounded-2xl bg-[#141415] border border-zinc-800/70 space-y-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-zinc-500" />
          <h2 className="text-base font-semibold text-white">Калькулятор USDT</h2>
        </div>

        <div className="space-y-2">
          <input
            id="market-calc-input"
            type="number"
            value={calcAmount}
            onChange={(e) => setCalcAmount(e.target.value)}
            placeholder="100"
            className="w-full bg-black/30 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-3 text-sm text-white font-mono outline-none transition-colors"
          />

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {presetAmounts.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => {
                  sound.playTap();
                  setCalcAmount(amt.toString());
                }}
                className={`py-1 px-2.5 rounded-lg text-xs font-mono border transition-colors cursor-pointer ${
                  parsedAmount === amt
                    ? 'bg-zinc-100 text-black border-zinc-100'
                    : 'bg-transparent text-zinc-400 border-zinc-800 hover:border-zinc-600'
                }`}
              >
                {amt} $
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500">К выплате по СБП</div>
            <div className="text-xl font-semibold text-[#A3FF12] mt-0.5">
              {Number(calculatedRub).toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              1 USDT = {effectiveRubRate.toFixed(2)} ₽ · бонус +{tier.rateBonus}%
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sound.playTap();
              onQuickSell('USDT');
            }}
            className="py-2 px-3.5 rounded-lg bg-[#A3FF12] hover:bg-[#b2ff33] text-black text-xs font-semibold cursor-pointer transition-colors"
          >
            Продать
          </button>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-[#141415] border border-zinc-800/70 space-y-3">
        <h3 className="text-sm font-medium text-white">Оптовые надбавки</h3>
        <div className="space-y-1.5">
          {VOLUME_TIERS.map((vt) => (
            <div key={vt.id} className="flex items-center justify-between text-sm py-1.5">
              <span className="text-zinc-400">{vt.badge}</span>
              <span className="text-zinc-200 font-mono">
                {vt.rateBonusPercent > 0 ? `+${vt.rateBonusPercent}%` : '0%'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
