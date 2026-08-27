import { Text } from "@cloudflare/kumo";

interface SectionHeadingProps {
  id: string;
  title: string;
  meta: string;
}

export function SectionHeading({ id, title, meta }: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <h2 id={id} className="section-title">
        <Text as="span" variant="heading">
          {title}
        </Text>
      </h2>
      <div className="section-meta" aria-hidden="true">
        <span className="section-rule" />
        <Text as="span" variant="mono-secondary">
          {meta}
        </Text>
      </div>
    </div>
  );
}
