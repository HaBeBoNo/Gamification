export const config = { runtime: 'edge' };

async function invokeSupabaseFunction(name) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { name, ok: false, status: 500, body: 'Supabase not configured' };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    const body = await response.text();
    return {
      name,
      ok: response.ok,
      status: response.status,
      body,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      status: 500,
      body: String(error),
    };
  }
}

export default async function handler() {
  const results = await Promise.all([
    invokeSupabaseFunction('calendar-reminders'),
  ]);

  const ok = results.every((result) => result.ok);

  return new Response(JSON.stringify({ ok, results }), {
    status: ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
