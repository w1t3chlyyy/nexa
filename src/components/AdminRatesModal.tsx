import React, { useEffect, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
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
      setError('Supabase не настроен');
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
    (data || []).forEach((r: RateRow) => {
      initial[r.id] = String(r.rate_rub);
    });
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
    const crypto = SUPPORTED_CRYPTOS.find((c) => c.symbol === row.crypto_symbol);
    if (crypto) crypto.priceRub = value;
    sound.playSuccess();
    loadRates();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-sm bg-[#141415] border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-sm font-medium text-white">Курсы обмена</span>
          <button
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="w-7 h-7 rounded-lg text-zinc-500 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2.5">
          {error && <div className="text-xs text-rose-400">{error}</div>}

          {loading ? (
            <div className="text-center text-xs text-zinc-500 py-4 flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Загрузка
            </div>
          ) : rates.length === 0 ? (
            <div className="text-center text-xs text-zinc-500 py-4">Нет курсов в таблице exchange_rates</div>
          ) : (
            rates.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <span className="text-xs text-white w-12">{row.crypto_symbol}</span>
                <input
                  type="number"
                  step="0.01"
                  value={editValues[row.id] ?? ''}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  className="flex-1 bg-black/30 border border-zinc-800 focus:border-zinc-600 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none transition-colors"
                />
                <button
                  onClick={() => handleSave(row)}
                  disabled={saving === row.id}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-black text-xs font-medium cursor-pointer disabled:opacity-40 transition-colors"
                >
                  {saving === row.id ? '...' : 'Сохранить'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
