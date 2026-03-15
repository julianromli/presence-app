import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { shouldUseLightweightMarketingHome } from '@/lib/runtime-flags';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site-config';

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  email: 'hello@absenin.id',
};

const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'IDR',
  },
};

function LightweightMarketingHome() {
  return (
    <section className="bg-background px-6 py-14 lg:px-0">
      <div className="container px-0 md:px-6">
        <div className="mx-auto max-w-4xl rounded-[28px] border border-border bg-card p-8 shadow-[0_24px_80px_-32px_rgba(13,13,18,0.22)] sm:p-10">
          <p className="text-tagline text-sm font-medium uppercase tracking-[0.18em]">
            Dev Fast Mode
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Homepage marketing interaktif dimatikan sementara di local development
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Halaman ini sengaja diringankan agar startup `bun dev` dan request awal
            tetap cepat saat Anda mengerjakan dashboard, API, dan alur aplikasi utama.
            Production tetap memakai homepage marketing penuh.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button render={<Link href="/sign-up" />}>
              Buka sign up
            </Button>
            <Button render={<Link href="/dashboard" />} variant="outline">
              Buka dashboard
            </Button>
            <Button render={<Link href="/mockup/dashboard" />} variant="outline">
              Lihat mockup
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function Home() {
  if (shouldUseLightweightMarketingHome()) {
    return <LightweightMarketingHome />;
  }

  const [
    { default: MetafiCta },
    { default: MetafiFaq },
    { default: MetafiFeatures },
    { default: MetafiHero },
    { default: MetafiIntegrations },
    { default: MetafiLogos },
    { default: MetafiTestimonials },
  ] = await Promise.all([
    import('@/components/sections/matafi-cta'),
    import('@/components/sections/metafi-faq'),
    import('@/components/sections/metafi-features'),
    import('@/components/sections/metafi-hero'),
    import('@/components/sections/metafi-integrations'),
    import('@/components/sections/metafi-logos'),
    import('@/components/sections/metafi-testimonials'),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([organizationSchema, softwareSchema]),
        }}
      />
      <MetafiHero />
      <MetafiLogos />
      <MetafiFeatures />
      <MetafiIntegrations />
      <MetafiTestimonials />
      <MetafiFaq />
      <MetafiCta />
    </>
  );
}
