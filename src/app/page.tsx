import './marketing.css';
import './sentinel/sentinel.css';
import { MarketingHeader } from '@/components/landing/MarketingHeader';
import { QcipherHero, UnifiedHero, NineAttackers, NinthExplainer } from '@/components/sentinel/QuantumLanding';
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

      {/* dark home: Qcipher leads, then the unified Sentinel block (eight/ninth) */}
      <div className="sn">
        <div className="sn-wrap">
          <QcipherHero />
          <UnifiedHero />
          <NineAttackers />
          <NinthExplainer />
        </div>
      </div>

      {/* existing light marketing sections (tabs target these) */}
      <main>
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
