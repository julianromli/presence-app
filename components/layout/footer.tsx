import { FacebookLogo, LinkedinLogo, XLogo } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';

const columns = [
  {
    title: 'Produk',
    links: [
      { name: 'Beranda', href: '/' },
      { name: 'Fitur', href: '/#fitur' },
      { name: 'Integrasi', href: '/#integrasi' },
      { name: 'Demo scan', href: '/scan' },
    ],
  },
  {
    title: 'Operasional',
    links: [
      { name: 'Dashboard', href: '/dashboard' },
      { name: 'QR Device', href: '/device-qr' },
      { name: 'FAQ', href: '/#faq' },
    ],
  },
  {
    title: 'Akses',
    links: [
      { name: 'Daftar', href: '/sign-up' },
      { name: 'Masuk', href: '/sign-in' },
      { name: 'Kontak', href: 'mailto:hello@absensi.id' },
    ],
  },
];

const socials = [
  { Icon: LinkedinLogo, href: 'https://linkedin.com' },
  { Icon: XLogo, href: 'https://twitter.com' },
  { Icon: FacebookLogo, href: 'https://facebook.com' },
];

export const Footer = () => {
  return (
    <footer className="force-light-vars bg-primary text-primary-foreground px-2.5 lg:px-0">
      <div className="container py-12 md:py-16">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="md:min-w-[140px]">
            <Link href="/" aria-label="Absensi.id" className="text-2xl font-bold tracking-tight">
              Absensi.id
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 md:flex md:w-[525px] md:items-start md:justify-between md:gap-0">
            {columns.map((col) => (
              <div key={col.title} className="min-w-0">
                <h3 className="text-muted-foreground mb-4 text-sm leading-tight font-medium">
                  {col.title}
                </h3>
                <ul className="space-y-3">
                  {col.links.map((l) => (
                    <li key={l.name}>
                      <Link
                        href={l.href}
                        className="text-primary-foreground/90 hover:text-primary-foreground text-sm font-normal transition-colors"
                      >
                        {l.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-border/40 mt-12 border-t" />

        <div className="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-muted-foreground text-sm font-normal">
            © {new Date().getFullYear()} Absensi.id. All rights reserved.
          </p>

          <div className="flex items-center gap-4">
            {socials.map(({ Icon, href }) => (
              <Link
                key={href}
                href={href}
                aria-label={href}
                className="text-muted-foreground hover:text-primary-foreground transition-colors"
              >
                <Icon weight="regular" className="h-5 w-5" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

