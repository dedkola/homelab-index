"use client";

import { Button, LayerCard, Text } from "@cloudflare/kumo";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="state-page">
      <LayerCard className="state-card">
        <Text as="h1" variant="heading">
          Dashboard unavailable
        </Text>
        <Button variant="secondary" size="sm" onClick={reset}>
          Retry
        </Button>
      </LayerCard>
    </main>
  );
}
