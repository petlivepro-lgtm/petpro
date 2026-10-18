import { Closing } from "@/components/closing";
import { Faq } from "@/components/faq";
import { Features } from "@/components/features";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { Pricing } from "@/components/pricing";
import { SiteHeader } from "@/components/site-header";
import { TutorKnows } from "@/components/tutor-knows";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <TutorKnows />
        <Features />
        <HowItWorks />
        <Pricing />
        <Faq />
      </main>
      <Closing />
    </>
  );
}
