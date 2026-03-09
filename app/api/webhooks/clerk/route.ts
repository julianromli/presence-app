import { verifyWebhook } from '@clerk/nextjs/webhooks';

import { getPublicConvexHttpClient } from '@/lib/convex-http';

function buildUserName(data: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}) {
  return [data.first_name, data.last_name].filter(Boolean).join(' ') || data.username || 'Unknown';
}

function buildPrimaryEmail(data: {
  id?: string | null;
  primary_email_address_id?: string | null;
  email_addresses?: Array<{ id?: string | null; email_address?: string | null }> | null;
}) {
  const primaryId = data.primary_email_address_id;
  const primaryEmail = data.email_addresses?.find((item) => item.id === primaryId)?.email_address;
  return primaryEmail ?? data.email_addresses?.[0]?.email_address ?? `${data.id ?? 'unknown'}@unknown.local`;
}

export async function POST(request: Request) {
  const sharedSecret = process.env.CLERK_SYNC_SHARED_SECRET;
  if (!sharedSecret) {
    return Response.json(
      { code: 'CONFIGURATION_ERROR', message: 'Missing CLERK_SYNC_SHARED_SECRET' },
      { status: 500 },
    );
  }

  const convex = getPublicConvexHttpClient();
  if (!convex) {
    return Response.json(
      { code: 'CONFIGURATION_ERROR', message: 'Convex URL missing' },
      { status: 500 },
    );
  }

  try {
    const event = await verifyWebhook(request);

    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        await convex.mutation('users:upsertFromClerkWebhook', {
          secret: sharedSecret,
          clerkUserId: event.data.id,
          name: buildUserName(event.data),
          email: buildPrimaryEmail(event.data),
        });
        break;
      }
      case 'user.deleted': {
        if (event.data.id) {
          await convex.mutation('users:deleteFromClerkWebhook', {
            secret: sharedSecret,
            clerkUserId: event.data.id,
          });
        }
        break;
      }
      default:
        break;
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { code: 'INVALID_WEBHOOK', message: 'Error verifying webhook' },
      { status: 400 },
    );
  }
}
