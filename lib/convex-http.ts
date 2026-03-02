import { ConvexHttpClient } from 'convex/browser';

export function getConvexHttpClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    return null;
  }

  return new ConvexHttpClient(url);
}
