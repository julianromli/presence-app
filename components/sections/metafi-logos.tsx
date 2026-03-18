import Image from 'next/image';

import { Reveal, RevealItem } from '@/components/ui/reveal';

const ITEMS = [
  { name: 'Mercury', src: '/images/logos/adobe.svg' },
  { name: 'Watershed', src: '/images/logos/evernote.svg' },
  { name: 'Retool', src: '/images/logos/spotify.svg' },
  { name: 'Descript', src: '/images/logos/airtable.svg' },
  { name: 'Perplexity', src: '/images/logos/asana.svg' },
  { name: 'Monzo', src: '/images/logos/notion.svg' },
  { name: 'Ramp', src: '/images/logos/mailchimp.svg' },
  { name: 'Raycast', src: '/images/logos/medium.svg' },
  { name: 'Arc', src: '/images/logos/square.svg' },
];

const MetafiLogos = () => {
  return (
    <section
      id="mitra"
      className="bg-background overflow-hidden px-6 lg:px-0"
    >
      <div className="container px-0 py-10 text-center sm:py-12 md:px-6 md:py-20">
        <Reveal delay={0.04}>
          <p className="text-muted-foreground text-sm sm:text-base">
            Dipercaya tim operasional dari berbagai industri
          </p>
        </Reveal>

        <div className="mt-12 flex flex-col items-center gap-10 sm:gap-12 md:gap-20">
          {/* Top row */}
          <ul className="flex flex-nowrap items-center justify-center gap-8 sm:gap-12 md:gap-16">
            {ITEMS.slice(0, 5).map((item, index) => (
              <RevealItem
                key={item.name}
                className="flex-shrink-0"
                delay={0.08 + index * 0.05}
                distance={18}
              >
                <div className="relative h-6 w-auto md:h-10">
                  <Image
                    src={item.src}
                    alt={item.name}
                    width={100}
                    height={40}
                    className="motion-surface h-6 w-auto opacity-75 brightness-0 contrast-[90%] hue-rotate-[190deg] invert-[0.43] saturate-[180%] sepia-[0.06] hover:opacity-100 md:h-10"
                    style={{ height: '100%', width: 'auto' }}
                  />
                </div>
              </RevealItem>
            ))}
          </ul>

          {/* Bottom row (slightly offset) */}
          <ul className="flex -translate-x-4 flex-nowrap items-center justify-center gap-8 sm:-translate-x-6 sm:gap-12 md:gap-16">
            {ITEMS.slice(5).map((item, index) => (
              <RevealItem
                key={item.name}
                className="flex-shrink-0"
                delay={0.22 + index * 0.05}
                distance={18}
              >
                <div className="relative h-6 w-auto md:h-10">
                  <Image
                    src={item.src}
                    alt={item.name}
                    width={100}
                    height={40}
                    className="motion-surface h-6 w-auto opacity-75 brightness-0 contrast-[90%] hue-rotate-[190deg] invert-[0.43] saturate-[180%] sepia-[0.06] hover:opacity-100 md:h-10"
                    style={{ height: '100%', width: 'auto' }}
                  />
                </div>
              </RevealItem>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default MetafiLogos;
