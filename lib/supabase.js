import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://izwsssbuuikxyiorrwnz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6d3Nzc2J1dWlreHlpb3Jyd256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxODcxOTQsImV4cCI6MjA5NDc2MzE5NH0.9C0YvvBvFgfF3JuyR5wfJrtJGTL8YYcF-geeD0H0VOk';

// Custom fetch with a 8-second timeout — prevents hanging on slow mobile networks
const fetchWithTimeout = (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});
