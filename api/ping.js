export const config = { runtime: 'edge' };

export default async function handler(req) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response('Supabase not configured', { status: 200 });
  }

  try {
    await fetch(`${supabaseUrl}/rest/v1/member_data?limit=1`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    return new Response('pong', { status: 200 });
  } catch {
    return new Response('ping failed', { status: 200 });
  }
}
