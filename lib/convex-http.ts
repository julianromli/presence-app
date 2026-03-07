import { ConvexHttpClient } from 'convex/browser';

type ConvexArgs = Record<string, unknown>;

export type ConvexHttpClientCompat = {
  setAuth(token: string): void;
  query<T = unknown>(name: string, args?: ConvexArgs): Promise<T>;
  mutation<T = unknown>(name: string, args?: ConvexArgs): Promise<T>;
  action<T = unknown>(name: string, args?: ConvexArgs): Promise<T>;
};

export function getConvexHttpClient(): ConvexHttpClientCompat | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    return null;
  }

  return new ConvexHttpClient(url) as unknown as ConvexHttpClientCompat;
}

export function getAuthedConvexHttpClient(token: string): ConvexHttpClientCompat | null {
  const client = getConvexHttpClient();
  if (!client) {
    return null;
  }

  client.setAuth(token);
  return client;
}

export function getPublicConvexHttpClient() {
  return getConvexHttpClient();
}
