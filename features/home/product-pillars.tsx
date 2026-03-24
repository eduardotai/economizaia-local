import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { foundationPillars } from "@/models/foundation";

export function ProductPillars() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {foundationPillars.map((pillar) => (
        <Card key={pillar.title}>
          <CardTitle>{pillar.title}</CardTitle>
          <CardDescription className="mt-3 leading-6">{pillar.description}</CardDescription>
        </Card>
      ))}
    </section>
  );
}