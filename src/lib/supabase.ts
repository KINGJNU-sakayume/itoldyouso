import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { VaultDoc } from '../types';

/**
 * Optional cloud sync. Without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY the
 * app runs entirely on localStorage and this module never loads the client.
 */
const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const KEY_ = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const cloudEnabled = /^https:\/\/[^/]+/.test(URL_) && KEY_.length > 20 && !/your[-_]/i.test(URL_ + KEY_);

const TABLE = 'itys_vault';

let clientPromise: Promise<SupabaseClient> | null = null;

export function getClient(): Promise<SupabaseClient> {
  if (!cloudEnabled) return Promise.reject(new Error('Cloud sync is not configured'));
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL_, KEY_, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'itys-cloud-auth' },
    }),
  );
  return clientPromise;
}

export async function getSession(): Promise<Session | null> {
  const sb = await getClient();
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function onAuthChange(cb: (session: Session | null) => void): Promise<() => void> {
  const sb = await getClient();
  const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<Session> {
  const sb = await getClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut(): Promise<void> {
  const sb = await getClient();
  await sb.auth.signOut();
}

export interface RemoteDoc {
  doc: unknown;
  rev: number;
}

export async function fetchRemote(): Promise<RemoteDoc | null> {
  const sb = await getClient();
  const { data, error } = await sb.from(TABLE).select('doc, rev').maybeSingle();
  if (error) throw error;
  return data as RemoteDoc | null;
}

/**
 * Writes the document only if nobody else wrote since `baseRev`
 * (optimistic locking). Returns false on a conflict so the caller can re-merge.
 */
export async function pushRemote(doc: VaultDoc, baseRev: number | null, owner: string): Promise<number | false> {
  const sb = await getClient();
  if (baseRev == null) {
    const { error } = await sb.from(TABLE).insert({ owner, doc, rev: 1 });
    if (error) {
      if (error.code === '23505') return false;
      throw error;
    }
    return 1;
  }
  const { data, error } = await sb
    .from(TABLE)
    .update({ doc, rev: baseRev + 1, updated_at: new Date().toISOString() })
    .eq('owner', owner)
    .eq('rev', baseRev)
    .select('rev');
  if (error) throw error;
  return data && data.length ? baseRev + 1 : false;
}

/** Rows of the pre-2026.09 multi-user schema, if that table still exists. */
export async function fetchLegacyClaims(): Promise<unknown[]> {
  const sb = await getClient();
  const { data, error } = await sb.from('claims').select('*').order('created_at');
  if (error) throw error;
  return data ?? [];
}
