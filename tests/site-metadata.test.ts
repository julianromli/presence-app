import { describe, expect, it } from "vitest";

import manifest from "../app/manifest";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
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
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toEqual(
      expect.arrayContaining([
        `${SITE_URL}/`,
        `${SITE_URL}/privacy`,
        `${SITE_URL}/terms`,
      ]),
    );
  });
});
