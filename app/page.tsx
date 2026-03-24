import { HeroSection } from "@/features/home/hero-section";
import { ProductPillars } from "@/features/home/product-pillars";
import { LocalReadinessPanel } from "@/features/home/local-readiness-panel";
import { FakeSimulationPreview } from "@/features/home/fake-simulation-preview";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-10 md:px-8 lg:px-12">
      <HeroSection />
      <ProductPillars />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <LocalReadinessPanel />
        <FakeSimulationPreview />
      </div>
    </main>
  );
}