"use client";

import { LayerCard, LinkButton, Text, Tooltip } from "@cloudflare/kumo";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";

import type { QuickLink } from "@/features/dashboard/types";

interface QuickLinkCardProps {
  link: QuickLink;
}

export function QuickLinkCard({ link }: QuickLinkCardProps) {
  return (
    <LayerCard className="quick-link-card">
      <div className="quick-link-identity">
        <div className="quick-link-glyph" aria-hidden="true">
          {link.glyph}
        </div>
        <Text as="span" variant="body" bold truncate>
          {link.name}
        </Text>
      </div>
      <Tooltip
        content={`Open ${link.name}`}
        render={
          <LinkButton
            href={link.url}
            external
            variant="outline"
            size="xs"
            shape="square"
            icon={ArrowSquareOutIcon}
            aria-label={`Open ${link.name} in a new window`}
          />
        }
      />
    </LayerCard>
  );
}
