import MetafiCta from '@/components/sections/matafi-cta';
import MetafiFaq from '@/components/sections/metafi-faq';
import MetafiFeatures from '@/components/sections/metafi-features';
import MetafiHero from '@/components/sections/metafi-hero';
import MetafiIntegrations from '@/components/sections/metafi-integrations';
import MetafiLogos from '@/components/sections/metafi-logos';
import MetafiTestimonials from '@/components/sections/metafi-testimonials';

export default function Home() {
  return (
    <>
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
