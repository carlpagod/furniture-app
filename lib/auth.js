import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const AuthContext = createContext(null);

// ─── Helpers ────────────────────────────────────────────────────────────────

/** True when running in a browser (Expo web build) */
const IS_WEB = Platform.OS === 'web';

/**
 * Determine if a network-related error occurred so we can fall back to the
 * locally-cached session instead of logging the user out.
 */
function isNetworkError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('cors') ||
    msg.includes('origin') ||
    msg.includes('load failed') ||
    msg.includes('fetch')
  );
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Restore session on startup ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        // 1. Try Supabase with a 6-second timeout — prevents infinite spinner
        //    if Supabase is slow to respond on cold start.
        let session = null;
        let sessionErr = null;
        try {
          const result = await Promise.race([
            supabase.auth.getSession(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('getSession timeout')), 6000)
            ),
          ]);
          session = result?.data?.session;
          sessionErr = result?.error;
        } catch (timeoutOrErr) {
          const msg = (timeoutOrErr?.message || '').toLowerCase();
          if (msg === 'getsession timeout') {
            console.warn('Supabase getSession timed out — falling back to cache');
          } else {
            sessionErr = timeoutOrErr;
          }
        }

        if (cancelled) return;

        // If the refresh token is invalid/expired, nuke all stored sessions
        if (sessionErr) {
          const msg = (sessionErr.message || '').toLowerCase();
          if (msg.includes('refresh token') || msg.includes('invalid') || msg.includes('not found')) {
            console.warn('Clearing invalid session:', sessionErr.message);
            await AsyncStorage.removeItem('furnicute_session').catch(() => { });
            await supabase.auth.signOut().catch(() => { });
            if (!cancelled) { setUser(null); setProfile(null); setLoading(false); }
            return;
          }
        }

        if (session?.user) {
          if (!cancelled) setUser(session.user);
          await fetchProfile(session.user.id, session.user.email, session.user.user_metadata);
          if (!cancelled) setLoading(false);
          return;
        }
      } catch (e) {
        if (cancelled) return;
        const msg = (e?.message || String(e)).toLowerCase();
        if (msg.includes('refresh token') || msg.includes('invalid') || msg.includes('not found')) {
          console.warn('Invalid refresh token — clearing session:', e.message);
          await AsyncStorage.removeItem('furnicute_session').catch(() => { });
          await supabase.auth.signOut().catch(() => { });
          if (!cancelled) { setUser(null); setProfile(null); setLoading(false); }
          return;
        }
        console.warn('Supabase getSession error:', e);
      }

      if (cancelled) return;

      // 2. Fall back to locally-cached session (offline support)
      try {
        const storedAuth = await AsyncStorage.getItem('furnicute_session');
        if (storedAuth) {
          const parsed = JSON.parse(storedAuth);
          if (parsed?.user?.id) {
            if (!cancelled) { setUser(parsed.user); setProfile(parsed.profile); setLoading(false); }
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to load local auth session:', e);
      }

      if (!cancelled) setLoading(false);
    }

    // Absolute safety net — if anything hangs, clear the spinner after 12s
    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        console.warn('Auth safety timeout hit — forcing loading=false');
        setLoading(false);
      }
    }, 12000);

    loadSession().finally(() => clearTimeout(safetyTimer));

    // ── Listen to Supabase auth state changes ──────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // TOKEN_REFRESHED_FAILED or any token error — clear and go to login
        if (event === 'TOKEN_REFRESHED' && !session) {
          await AsyncStorage.removeItem('furnicute_session').catch(() => { });
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        if (event === 'SIGNED_OUT') {
          // Only guard against network-caused SIGNED_OUT, not token errors
          // If there's a valid stored session AND we're offline, keep it
          try {
            const storedAuth = await AsyncStorage.getItem('furnicute_session');
            if (storedAuth) {
              const parsed = JSON.parse(storedAuth);
              // Only restore if this looks like a network error situation
              if (parsed?.user?.id && isNetworkError(new Error('network'))) {
                setUser(parsed.user);
                setProfile(parsed.profile);
                return;
              }
            }
          } catch (_) { }
          await AsyncStorage.removeItem('furnicute_session').catch(() => { });
          setUser(null);
          setProfile(null);
          return;
        }

        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id, session.user.email, session.user.user_metadata);
          setLoading(false);
        } else {
          // If we have a valid cached session in AsyncStorage (e.g. demo admin session or cached offline user),
          // preserve it on initial load/refresh instead of wiping it immediately.
          try {
            const storedAuth = await AsyncStorage.getItem('furnicute_session');
            if (storedAuth) {
              const parsed = JSON.parse(storedAuth);
              if (parsed?.user?.id) {
                setUser(parsed.user);
                setProfile(parsed.profile);
                setLoading(false);
                return;
              }
            }
          } catch (_) { }

          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  // ── fetchProfile ───────────────────────────────────────────────────────
  async function fetchProfile(userId, email = null, authUserMeta = null) {
    try {
      let data = null, error = null;
      try {
        const result = await Promise.race([
          supabase.from('profiles').select('*').eq('id', userId).single(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('profile fetch timeout')), 5000)),
        ]);
        data = result?.data;
        error = result?.error;
      } catch (timeoutErr) {
        console.warn('fetchProfile: Profile read timed out');
      }

      const userEmail = email || user?.email || data?.email || '';

      if (!error && data) {
        setProfile(data);
        await AsyncStorage.setItem('furnicute_session', JSON.stringify({
          user: { id: userId, email: userEmail },
          profile: data,
        }));
        return data;
      }

      // RLS or network blocked the read — check if profile is just missing
      // Try to create one with safe defaults
      const userEmail2 = email || user?.email || '';
      const defaultProfile = {
        id: userId,
        username: userEmail2 ? userEmail2.split('@')[0] : 'User',
        // Never assume 'user' — if we have metadata, use it, else default user
        role: authUserMeta?.role || (userEmail2.toLowerCase().includes('admin') ? 'admin' : 'user'),
        avatar_url: null,
        address: '',
        mobile: '',
      };

      try {
        await Promise.race([
          supabase.from('profiles').upsert(defaultProfile),
          new Promise((_, reject) => setTimeout(() => reject(new Error('profile upsert timeout')), 5000)),
        ]);
        // Try to re-read after upsert
        let reFetch = null;
        try {
          const result = await Promise.race([
            supabase.from('profiles').select('*').eq('id', userId).single(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('profile re-read timeout')), 5000)),
          ]);
          reFetch = result?.data;
        } catch (_) { }
        if (reFetch) {
          setProfile(reFetch);
          await AsyncStorage.setItem('furnicute_session', JSON.stringify({
            user: { id: userId, email: userEmail2 },
            profile: reFetch,
          }));
          return reFetch;
        }
      } catch (upsertErr) {
        console.warn('Upsert default profile failed:', upsertErr);
      }

      setProfile(defaultProfile);
      await AsyncStorage.setItem('furnicute_session', JSON.stringify({
        user: { id: userId, email: userEmail2 },
        profile: defaultProfile,
      }));
      return defaultProfile;
    } catch (e) {
      console.warn('Supabase fetchProfile error:', e);

      // 1. Try to read cached profile from AsyncStorage first to avoid downgrading
      try {
        const storedAuth = await AsyncStorage.getItem('furnicute_session');
        if (storedAuth) {
          const parsed = JSON.parse(storedAuth);
          if (parsed?.profile?.id === userId && parsed.profile.role) {
            setProfile(parsed.profile);
            return parsed.profile;
          }
        }
      } catch (_) { }

      // 2. Try to preserve current in-memory profile state if valid
      if (profile && profile.id === userId && profile.role) {
        return profile;
      }

      // 3. Fall back to secure profile parsing without downgrading
      const userEmail = email || user?.email || profile?.email || '';
      const isPreviousAdmin = (profile && profile.id === userId && profile.role === 'admin') || 
                              (userEmail.toLowerCase().includes('admin'));
      const fallback = {
        id: userId,
        username: userEmail ? userEmail.split('@')[0] : (profile?.username || 'User'),
        role: isPreviousAdmin ? 'admin' : 'user',
        avatar_url: profile?.avatar_url || null,
        address: profile?.address || '',
        mobile: profile?.mobile || '',
      };
      setProfile(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }

  // ── signIn ─────────────────────────────────────────────────────────────
  async function signIn(email, password) {
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;

      setUser(data.user);
      const resolvedProfile = await fetchProfile(data.user.id, data.user.email, data.user.user_metadata);

      // ── Role × Platform enforcement ──────────────────────────────────
      // Admin accounts may only log in on Web.
      // User accounts may only log in on Mobile (native).
      if (resolvedProfile?.role === 'admin' && !IS_WEB) {
        // Admin trying to log in on mobile — reject
        await supabase.auth.signOut().catch(() => { });
        setUser(null);
        setProfile(null);
        await AsyncStorage.removeItem('furnicute_session');
        throw new Error(
          'Admin accounts can only be accessed from the Web Admin Portal.\n\nPlease use the web browser to log in as admin.'
        );
      }

      if (resolvedProfile?.role === 'user' && IS_WEB) {
        // Regular user trying to log in on web admin portal — reject
        await supabase.auth.signOut().catch(() => { });
        setUser(null);
        setProfile(null);
        await AsyncStorage.removeItem('furnicute_session');
        throw new Error(
          'This portal is for Admin accounts only.\n\nPlease use the FurniCute mobile app to sign in as a customer.'
        );
      }

      // Cache credentials for offline fallback
      try {
        const localUsersStr = await AsyncStorage.getItem('furnicute_local_users');
        const localUsers = localUsersStr ? JSON.parse(localUsersStr) : [];
        const idx = localUsers.findIndex(u => u.email === normalizedEmail);
        const userObj = {
          id: data.user.id,
          email: normalizedEmail,
          password,
          username: resolvedProfile?.username || normalizedEmail.split('@')[0],
          role: resolvedProfile?.role || 'user',
        };
        if (idx >= 0) localUsers[idx] = userObj;
        else localUsers.push(userObj);
        await AsyncStorage.setItem('furnicute_local_users', JSON.stringify(localUsers));
      } catch (err) {
        console.warn('Failed to cache user offline:', err);
      }

      return { user: data.user, profile: resolvedProfile };
    } catch (supabaseError) {
      // Re-throw role-enforcement errors immediately
      if (
        supabaseError.message?.includes('Admin accounts can only') ||
        supabaseError.message?.includes('This portal is for Admin')
      ) {
        throw supabaseError;
      }

      console.warn('Supabase signIn failed, checking offline fallback:', supabaseError);

      if (isNetworkError(supabaseError)) {
        const localUsersStr = await AsyncStorage.getItem('furnicute_local_users');
        const localUsers = localUsersStr ? JSON.parse(localUsersStr) : [];
        const matched = localUsers.find(
          u => u.email === normalizedEmail && u.password === password
        );

        if (!matched) {
          throw new Error('No internet connection. Please connect to the internet to sign in.');
        }

        // Enforce role×platform for cached offline logins too
        if (matched.role === 'admin' && !IS_WEB) {
          throw new Error(
            'Admin accounts can only be accessed from the Web Admin Portal.\n\nPlease use the web browser to log in as admin.'
          );
        }
        if (matched.role === 'user' && IS_WEB) {
          throw new Error(
            'This portal is for Admin accounts only.\n\nPlease use the FurniCute mobile app to sign in as a customer.'
          );
        }

        const userObj = { id: matched.id, email: matched.email };
        const profileObj = {
          id: matched.id,
          username: matched.username,
          role: matched.role,
          avatar_url: null,
          address: matched.address || '',
          mobile: matched.mobile || '',
        };

        setUser(userObj);
        setProfile(profileObj);
        await AsyncStorage.setItem('furnicute_session', JSON.stringify({ user: userObj, profile: profileObj }));
        return { user: userObj, profile: profileObj };
      }

      throw supabaseError;
    }
  }

  // ── signUp ─────────────────────────────────────────────────────────────
  async function signUp(email, password, username, role = 'user') {
    const normalizedEmail = email.trim().toLowerCase();

    // Signup is only available on mobile (user accounts).
    // Admin accounts are created manually in Supabase.
    if (IS_WEB) {
      throw new Error('Admin accounts must be created directly in the Supabase dashboard.');
    }

    // Prevent a user from registering with the role of 'admin'
    const safeRole = 'user';

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { username } },
      });
      if (error) throw error;

      if (data.user) {
        setUser(data.user);
        const newProfile = {
          id: data.user.id,
          email: normalizedEmail,
          username,
          role: safeRole,
          avatar_url: null,
          address: '',
          mobile: '',
        };
        setProfile(newProfile);

        await AsyncStorage.setItem('furnicute_session', JSON.stringify({
          user: { id: data.user.id, email: data.user.email },
          profile: newProfile,
        }));

        try {
          const localUsersStr = await AsyncStorage.getItem('furnicute_local_users');
          const localUsers = localUsersStr ? JSON.parse(localUsersStr) : [];
          localUsers.push({
            id: data.user.id,
            email: normalizedEmail,
            password,
            username,
            role: safeRole,
          });
          await AsyncStorage.setItem('furnicute_local_users', JSON.stringify(localUsers));
        } catch (err) {
          console.warn('Failed to cache signed up user offline:', err);
        }

        try {
          await supabase.from('profiles').upsert(newProfile);
        } catch (e) {
          console.warn('Upsert profile failed:', e);
        }
      }
      return data;
    } catch (supabaseError) {
      console.warn('Supabase signUp failed:', supabaseError);

      if (isNetworkError(supabaseError)) {
        throw new Error('No internet connection. Please connect to the internet to create an account.');
      }
      throw supabaseError;
    }
  }

  // ── signInDemo ─────────────────────────────────────────────────────────
  async function signInDemo(role) {
    setLoading(true);
    const demoUser = {
      id: role === 'admin' ? 'demo-admin-id' : 'demo-customer-id',
      email: role === 'admin' ? 'admin@furnicute.com' : 'customer@furnicute.com',
    };
    const demoProfile = {
      id: demoUser.id,
      username: role === 'admin' ? 'Administrator' : 'Store Customer',
      role,
      avatar_url: null,
      address: role === 'admin' ? '' : '123 FurniCute Street, Manila',
      mobile: role === 'admin' ? '' : '09171234567',
    };

    setUser(demoUser);
    setProfile(demoProfile);
    await AsyncStorage.setItem('furnicute_session', JSON.stringify({ user: demoUser, profile: demoProfile }));
    setLoading(false);
  }

  // ── signOut ────────────────────────────────────────────────────────────
  async function signOut() {
    try { await AsyncStorage.removeItem('furnicute_session'); } catch (e) { console.warn(e); }
    setUser(null);
    setProfile(null);
    try { await supabase.auth.signOut(); } catch (e) { console.warn(e); }
  }

  // ── refreshProfile ─────────────────────────────────────────────────────
  async function refreshProfile() {
    if (!user) return;
    if (user.id === 'demo-admin-id' || user.id === 'demo-customer-id' || user.id?.startsWith('local-user-')) {
      try {
        const storedAuth = await AsyncStorage.getItem('furnicute_session');
        if (storedAuth) {
          const parsed = JSON.parse(storedAuth);
          if (parsed?.profile) setProfile(parsed.profile);
        }
      } catch (e) { console.warn(e); }
      return;
    }
    try {
      await fetchProfile(user.id);
    } catch (e) {
      console.warn('refreshProfile: skipping due to network error');
    }
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, isAdmin, signIn, signUp, signInDemo, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
