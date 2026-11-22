import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceKey || !anonKey) return json({ error: 'Server auth configuration is incomplete.' }, 500);

  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Přihlaste se jako administrátor.' }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: authError } = await admin.auth.getUser(token);
  if (authError || !userData.user) return json({ error: 'Přihlášení není platné.' }, 401);

  const { data: profile, error: profileError } = await admin
    .from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
  if (profileError) return json({ error: 'Nepodařilo se ověřit roli administrátora.' }, 500);
  if (profile?.role !== 'admin') return json({ error: 'Tato stránka je pouze pro administrátory.' }, 403);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: 'Neplatný požadavek.' }, 400); }
  const action = body.action;

  try {
    if (action === 'overview') {
      const users: Array<{ id: string; email?: string; created_at?: string }> = [];
      for (let page = 1; page <= 100; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
        if (error) throw error;
        users.push(...data.users.map(user => ({ id: user.id, email: user.email, created_at: user.created_at })));
        if (data.users.length < 100) break;
      }
      const [{ data: profiles, error: profilesError }, { data: classes, error: classesError }] = await Promise.all([
        admin.from('profiles').select('id,role'),
        admin.from('classes').select('id,user_id,name,rows,desks_per_row,created_at').order('created_at', { ascending: false }),
      ]);
      if (profilesError) throw profilesError;
      if (classesError) throw classesError;
      const roleById = new Map((profiles || []).map(profile => [profile.id, profile.role]));
      return json({
        users: users.map(user => ({ ...user, role: roleById.get(user.id) || 'teacher' })),
        classes: classes || [],
      });
    }

    if (action === 'invite-user') {
      const email = String(body.email || '').trim().toLowerCase();
      const role = body.role === 'admin' ? 'admin' : 'teacher';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Zadejte platnou e-mailovou adresu.' }, 400);
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
      if (error) throw error;
      if (data.user) {
        const { error: roleError } = await admin.from('profiles').upsert({ id: data.user.id, role }, { onConflict: 'id' });
        if (roleError) throw roleError;
      }
      return json({ message: 'Pozvánka byla odeslána.' });
    }

    if (action === 'set-role') {
      const userId = String(body.userId || '');
      const role = body.role;
      if (!userId || !['teacher', 'admin'].includes(String(role))) return json({ error: 'Neplatný uživatel nebo role.' }, 400);
      const { data: target, error: targetError } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
      if (targetError) throw targetError;
      if (!target) return json({ error: 'Profil uživatele nebyl nalezen.' }, 404);
      if (target.role === 'admin' && role === 'teacher') {
        const { count, error: countError } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
        if (countError) throw countError;
        if ((count || 0) <= 1) return json({ error: 'Posledního administrátora nelze odebrat.' }, 400);
      }
      const { error } = await admin.from('profiles').update({ role }).eq('id', userId);
      if (error) throw error;
      return json({ message: 'Role byla změněna.' });
    }

    if (action === 'send-password-reset') {
      const userId = String(body.userId || '');
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error || !data.user?.email) return json({ error: 'E-mail uživatele nebyl nalezen.' }, 404);
      const siteUrl = Deno.env.get('APP_SITE_URL');
      if (!siteUrl) return json({ error: 'Nastavte Edge Function secret APP_SITE_URL.' }, 500);
      const publicClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error: resetError } = await publicClient.auth.resetPasswordForEmail(data.user.email, {
        redirectTo: `${siteUrl.replace(/\/$/, '')}/reset-password/`,
      });
      if (resetError) throw resetError;
      return json({ message: `Odkaz pro změnu hesla byl odeslán na ${data.user.email}.` });
    }

    if (action === 'delete-class') {
      const classId = String(body.classId || '');
      if (!classId) return json({ error: 'Chybí identifikátor třídy.' }, 400);
      const { error } = await admin.from('classes').delete().eq('id', classId);
      if (error) throw error;
      return json({ message: 'Třída byla smazána.' });
    }

    return json({ error: 'Neznámá administrátorská akce.' }, 400);
  } catch (error) {
    console.error('admin-api error:', error);
    return json({ error: error instanceof Error ? error.message : 'Administrátorská operace selhala.' }, 500);
  }
});
