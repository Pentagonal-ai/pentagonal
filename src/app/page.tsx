import './marketing.css';
import { MarketingHeader } from '@/components/landing/MarketingHeader';
import { Hero } from '@/components/landing/Hero';
import { Build } from '@/components/landing/Build';
import { Methodology } from '@/components/landing/Methodology';
import { Coverage } from '@/components/landing/Coverage';
import { SampleReport } from '@/components/landing/SampleReport';
import { Learning } from '@/components/landing/Learning';
import { Integration } from '@/components/landing/Integration';
import { Pricing } from '@/components/landing/Pricing';
import { Listed } from '@/components/landing/Listed';
import { MarketingFooter } from '@/components/landing/MarketingFooter';

export default function HomePage() {
  return (
    <div data-marketing="true">
      <MarketingHeader />
      <main>
        <Hero />
        <Build />
        <Methodology />
        <Coverage />
        <SampleReport />
        <Learning />
        <Integration />
        <Pricing />
        <Listed />
      </main>
      <MarketingFooter />
    </div>
  );
}
