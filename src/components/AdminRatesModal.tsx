import React, { useEffect, useState } from 'react';
import { X, Save, RefreshCw, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SUPPORTED_CRYPTOS } from '../data/mockData';
import { sound } from '../utils/sound';

interface RateRow {
  id: string;
  crypto_symbol: string;
  rate_rub: number;
}

interface AdminRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminRatesModal: React.FC<AdminRatesModalProps> = ({ isOpen, onClose }) => {
  const [rates, setRates] = useState<RateRow[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) loadRates();
  }, [isOpen]);

  const loadRates = async () => {
    if (!supabase) {
      setError('Supabase не настроен (проверьте .env)');
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('exchange_rates')
      .select('*')
      .order('crypto_symbol', { ascending: true });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setRates(data || []);
    const initial: Record<string, string> = {};
    (data || []).forEach((r: RateRow) => { initial[r.id] = String(r.rate_rub); });
    setEditValues(initial);
  };

  const handleSave = async (row: RateRow) => {
    if (!supabase) return;
    const value = parseFloat(editValues[row.id]);
    if (isNaN(value) || value <= 0) {
      setError('Введите корректный курс');
      return;
    }
    setSaving(row.id);
    setError('');
    const { error: err } = await supabase
      .from('exchange_rates')
      .update({ rate_rub: value, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    setSaving(null);
    if (err) {
      setError(err.message);
      return;
    }

    // Мгновенно применяем новый курс в приложении (без перезагрузки)
    const crypto = SUPPORTED_CRYPTOS.find((c) => c.symbol === row.crypto_symbol);
    if (crypto) crypto.priceRub = value;

    sound.playSuccess();
    loadRates();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-[#181818] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1E2514] border border-[#A3FF12]/40 flex items-center justify-center text-[#A3FF12]">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-xs font-bold text-white">Курсы обмена (Админ)</h2>
          </div>
          <button
            onClick={() => { sound.playTap(); onClose(); }}
            className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-3.5 space-y-2.5">
          {error && (
            <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center text-xs text-zinc-400 py-4 flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Загрузка...
            </div>
          ) : rates.length === 0 ? (
            <div className="text-center text-xs text-zinc-400 py-4">Нет курсов в таблице exchange_rates</div>
          ) : (
            rates.map((row) => (
              <div key={row.id} className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-2">
                <span className="text-xs font-bold text-white w-14">{row.crypto_symbol}</span>
                <input
                  type="number"
                  step="0.01"
                  value={editValues[row.id] ?? ''}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  className="flex-1 bg-zinc-950 border border-zinc-700 focus:border-[#A3FF12] rounded-lg px-2 py-1 text-xs text-white font-mono outline-none"
                />
                <span className="text-[10px] text-zinc-500">₽</span>
                <button
                  onClick={() => handleSave(row)}
                  disabled={saving === row.id}
                  className="p-1.5 rounded-lg bg-[#A3FF12] hover:bg-[#b2ff33] text-black cursor-pointer disabled:opacity-50"
                >
                  {saving === row.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
