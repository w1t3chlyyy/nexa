import React, { useState } from 'react';
import {
  TrendingUp,
  ArrowRightLeft,
  Sparkles,
  Zap,
  ShieldCheck,
  Layers,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { TierInfo, CryptoSymbol } from '../types';
import { SUPPORTED_CRYPTOS, VOLUME_TIERS } from '../data/mockData';
import { sound } from '../utils/sound';

interface MarketViewProps {
  tier: TierInfo;
  onQuickSell: (symbol: CryptoSymbol) => void;
}

export const MarketView: React.FC<MarketViewProps> = ({ tier, onQuickSell }) => {
  const [calcAmount, setCalcAmount] = useState<string>('100');
  const [targetFiat, setTargetFiat] = useState<'RUB' | 'USD' | 'KZT'>('RUB');

  const currentCrypto = SUPPORTED_CRYPTOS[0]; // USDT
  const parsedAmount = parseFloat(calcAmount) || 0;
  const tierMultiplier = 1 + tier.rateBonus / 100;
  const effectiveRubRate = currentCrypto.priceRub * tierMultiplier;
  const calculatedRub = (parsedAmount * effectiveRubRate).toFixed(2);
  const calculatedUsd = (parsedAmount * currentCrypto.priceUsd).toFixed(2);
  const calculatedKzt = (parsedAmount * effectiveRubRate * 5.15).toFixed(0);

  const presetAmounts = [25, 50, 100, 300, 500, 1000];

  return (
    <div id="market-view" className="space-y-3 pb-20 select-none">
      {/* Live Calculator Card */}
      <div className="p-4 rounded-2xl bg-[#181818] border border-zinc-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1E2514] border border-[#A3FF12]/40 flex items-center justify-center text-[#A3FF12]">
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Калькулятор USDT</h2>
              <p className="text-[11px] text-zinc-400">Мгновенный расчет курса СБП</p>
            </div>
          </div>
          <span className="text-xs font-mono text-[#A3FF12] font-bold px-2 py-0.5 rounded-lg bg-[#1E2514] border border-[#A3FF12]/30 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" /> +{tier.rateBonus}% ранг
          </span>
        </div>

        {/* Input & Quick Presets */}
        <div className="space-y-2 pt-0.5">
          <div>
            <label className="block text-[10px] text-zinc-400 font-semibold mb-1">
              Количество USDT (чеки CryptoBot / Send):
            </label>
            <div className="relative">
              <input
                id="market-calc-input"
                type="number"
                value={calcAmount}
                onChange={(e) => setCalcAmount(e.target.value)}
                placeholder="100"
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-[#A3FF12] rounded-xl pl-3 pr-16 py-2.5 text-sm text-white font-mono font-bold focus:outline-none transition-all"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <span className="text-xs font-black text-emerald-400 font-mono">USDT</span>
              </div>
            </div>
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {presetAmounts.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => {
                  sound.playTap();
                  setCalcAmount(amt.toString());
                }}
                className={`py-1 px-2.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                  parsedAmount === amt
                    ? 'bg-[#A3FF12] text-black border-[#A3FF12]'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
                }`}
              >
                {amt} $
              </button>
            ))}
          </div>
        </div>

        {/* Result banner */}
        <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-zinc-400">
              К выплате на реквизиты СБП:
            </div>
            <div className="text-lg font-black font-mono text-[#A3FF12] tracking-tight mt-0.5">
              {targetFiat === 'RUB'
                ? `${Number(calculatedRub).toLocaleString('ru-RU')} ₽`
                : targetFiat === 'KZT'
                ? `${Number(calculatedKzt).toLocaleString('ru-RU')} ₸`
                : `$${calculatedUsd}`}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">
              1 USDT = {effectiveRubRate.toFixed(2)} ₽
            </div>
          </div>

          <div className="flex flex-col gap-1.5 items-end">
            <div className="flex bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
              {(['RUB', 'USD', 'KZT'] as const).map((fiat) => (
                <button
                  key={fiat}
                  type="button"
                  onClick={() => {
                    sound.playTap();
                    setTargetFiat(fiat);
                  }}
                  className={`px-2 py-0.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                    targetFiat === fiat
                      ? 'bg-[#A3FF12] text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {fiat === 'RUB' ? '₽' : fiat === 'KZT' ? '₸' : '$'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                sound.playTap();
                onQuickSell('USDT');
              }}
              className="py-1 px-3 rounded-lg bg-[#A3FF12] hover:bg-[#bef264] text-black text-xs font-extrabold flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              <Zap className="w-3 h-3 fill-black" />
              <span>Продать чек</span>
            </button>
          </div>
        </div>
      </div>

      {/* USDT Official Rate & Network Information Card */}
      <div className="p-3.5 rounded-2xl bg-[#181818] border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center font-bold text-xs text-emerald-400">
              ₮
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white">Tether USD (USDT)</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                  Основной актив
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">TRC-20 • TON • BEP-20 • ERC-20 • Solana</p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-bold font-mono text-white">
              {effectiveRubRate.toFixed(2)} ₽
            </div>
            <div className="text-[10px] font-mono font-bold text-[#A3FF12] flex items-center justify-end gap-0.5">
              <TrendingUp className="w-2.5 h-2.5" />
              <span>+0.12% 24ч</span>
            </div>
          </div>
        </div>

        {/* Benefits list */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800 text-[10.5px]">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#A3FF12] flex-shrink-0" />
            <span>0% комиссия сервиса</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Clock className="w-3.5 h-3.5 text-[#A3FF12] flex-shrink-0" />
            <span>Выплаты за 30-60 сек</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-300">
            <ShieldCheck className="w-3.5 h-3.5 text-[#A3FF12] flex-shrink-0" />
            <span>Официальный PDF чек</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Layers className="w-3.5 h-3.5 text-[#A3FF12] flex-shrink-0" />
            <span>Оптовые надбавки до +1.8%</span>
          </div>
        </div>
      </div>

      {/* Volume Tiers Scale */}
      <div className="p-3.5 rounded-2xl bg-[#181818] border border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#A3FF12]" />
            <h3 className="text-xs font-bold text-white">
              Оптовые бонусы на чеки USDT
            </h3>
          </div>
          <span className="text-[10px] text-zinc-400">Надбавка к бирже</span>
        </div>

        <div className="grid grid-cols-5 gap-1">
          {VOLUME_TIERS.map((vt) => (
            <div
              key={vt.id}
              className="py-1.5 px-1 rounded-lg text-center border bg-zinc-900 border-zinc-800 text-zinc-400"
            >
              <div className="text-[9px] font-mono text-zinc-400 truncate">
                {vt.badge}
              </div>
              <div className="text-[11px] font-bold font-mono text-[#A3FF12]">
                {vt.rateBonusPercent > 0 ? `+${vt.rateBonusPercent}%` : '0%'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
