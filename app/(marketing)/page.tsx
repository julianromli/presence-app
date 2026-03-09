import type { Metadata } from 'next';

import MetafiCta from '@/components/sections/matafi-cta';
import MetafiFaq from '@/components/sections/metafi-faq';
import MetafiFeatures from '@/components/sections/metafi-features';
import MetafiHero from '@/components/sections/metafi-hero';
import MetafiIntegrations from '@/components/sections/metafi-integrations';
import MetafiLogos from '@/components/sections/metafi-logos';
import MetafiTestimonials from '@/components/sections/metafi-testimonials';
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

export default function Home() {
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
