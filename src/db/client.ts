import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import ws from 'ws';
import { config } from '../config.js';

type WsTransport = NonNullable<NonNullable<SupabaseClientOptions<'public'>['realtime']>['transport']>;

// Backend memakai service key (bypass RLS). JANGAN pernah kirim key ini ke frontend.
export const db = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false },
  // supabase-js membangun RealtimeClient di konstruktor meski realtime tak dipakai;
  // Node 20 belum punya WebSocket global. Node 22+ tidak butuh ini.
  realtime: { transport: ws as unknown as WsTransport },
});
