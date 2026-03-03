import Banner from '@/components/layout/banner';
import { Footer } from '@/components/layout/footer';
import Navbar from '@/components/layout/navbar';

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Banner />
      <Navbar />
      {children}
      <Footer />
    </>
  );
}