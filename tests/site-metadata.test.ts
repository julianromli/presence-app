import { describe, expect, it } from "vitest";

import manifest from "../app/manifest";
import robots from "../app/robots";
import sitemap from "../app/sitemap";

describe("site metadata routes", () => {
  it("serves the production domain in robots.txt", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
      },
      sitemap: "https://absenin.id/sitemap.xml",
      host: "https://absenin.id",
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
        "https://absenin.id/",
        "https://absenin.id/privacy",
        "https://absenin.id/terms",
      ]),
    );
  });
});
