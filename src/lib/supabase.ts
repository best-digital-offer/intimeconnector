import { createClient } from '@supabase/supabase-js';

const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'https://mdshdergwurbckbjupwq.supabase.co';

const anonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kc2hkZXJnd3VyYmNrYmp1cHdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTgyNDMsImV4cCI6MjEwNTgzNDI0M30.gQfggldQqTgICywphoQCvPrgsH6qUvHQMbq-jrAmJrU';

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
