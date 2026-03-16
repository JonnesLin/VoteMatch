/**
 * Embed layout — minimal chrome for iframe embedding.
 * No header, no footer, no locale switcher.
 */
export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
