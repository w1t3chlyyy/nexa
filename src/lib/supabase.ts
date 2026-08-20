import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://enuhrsbphkhmigoxvegg.supabase.co';
const supabaseAnonKey = 'sb_publishable_SeMxICcl9Fm5n8wxJoMM3Q_iHdsAfLR';

console.log('Supabase URL:', supabaseUrl ? 'задан' : 'НЕ задан');
console.log('Supabase Key:', supabaseAnonKey ? 'задан' : 'НЕ задан');

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

console.log('Supabase client:', supabase ? 'создан' : 'null');
