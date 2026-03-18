import { describe, expect, it } from "vitest";

import manifest from "../app/manifest";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { PUBLIC_SITEMAP_ENTRIES } from "../lib/seo";
import { SITE_URL } from "../lib/site-config";

describe("site metadata routes", () => {
  it("serves the production domain in robots.txt", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
      },
      sitemap: `${SITE_URL}/sitemap.xml`,
      host: SITE_URL,
    });
  });

  it("serves brand-correct manifest metadata", () => {
    expect(manifest()).toMatchObject({
      name: "Absenin.id",
      short_name: "Absenin.id",
      start_url: "/",
      display: "standalone",
    });
  });

  it("includes public marketing and trust pages in the sitemap", () => {
    expect(sitemap()).toEqual(
      PUBLIC_SITEMAP_ENTRIES.map((entry) => ({
        url: entry.path === "/" ? `${SITE_URL}/` : `${SITE_URL}${entry.path}`,
        lastModified: entry.lastModified,
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
      })),
    );
  });
});
