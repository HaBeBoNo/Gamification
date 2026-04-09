import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getEnv(name, fallbackName) {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : '');
}

function getFirstEnv(...names) {
  for (const name of names) {
    if (name && process.env[name]) return process.env[name];
  }
  return '';
}

function isExpiredSubscriptionError(error) {
  const statusCode = Number(error?.statusCode || 0);
  return statusCode === 404 || statusCode === 410;
}

function parseRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = getFirstEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceRoleKey = getFirstEnv(
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_ROLE',
    'SUPABASE_SERVICE_KEY'
  );
  const vapidPublicKey = getEnv('VAPID_PUBLIC_KEY', 'VITE_VAPID_PUBLIC_KEY');
  const vapidPrivateKey = getEnv('VAPID_PRIVATE_KEY');
  const vapidSubject = getEnv('VAPID_SUBJECT');

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return res.status(500).json({
      error: 'Push server is not fully configured',
      missing: {
        supabaseUrl: !supabaseUrl,
        serviceRoleKey: !serviceRoleKey,
        vapidPublicKey: !vapidPublicKey,
        vapidPrivateKey: !vapidPrivateKey,
        vapidSubject: !vapidSubject,
      },
    });
  }

  const { title, body, url, exclude_member, target_member_keys } = parseRequestBody(req);

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  let query = supabase.from('push_subscriptions').select('*');

  if (Array.isArray(target_member_keys) && target_member_keys.length > 0) {
    query = query.in('member_key', target_member_keys);
  }
  if (exclude_member) {
    query = query.neq('member_key', exclude_member);
  }

  const { data: subs, error: queryError } = await query;
  if (queryError) {
    return res.status(500).json({ error: queryError.message || 'Failed to load subscriptions' });
  }

  const expiredSubscriptionIds = [];
  const results = await Promise.all(
    (subs || []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({ title, body, url })
        );
        return { status: 'fulfilled' };
      } catch (error) {
        if (isExpiredSubscriptionError(error)) {
          expiredSubscriptionIds.push(sub.id);
        } else {
          console.error('api/send-push failed:', error);
        }
        return { status: 'rejected' };
      }
    })
  );

  if (expiredSubscriptionIds.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', expiredSubscriptionIds);
  }

  return res.status(200).json({
    targeted: (subs || []).length,
    sent: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length,
    removed: expiredSubscriptionIds.length,
    transport: 'vercel-api',
  });
}
