import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/embed?election_id=...
 * Returns embed code snippet and configuration for a specific election.
 */
export async function GET(request: NextRequest) {
  const electionId = request.nextUrl.searchParams.get("election_id");

  if (!electionId) {
    return NextResponse.json(
      { error: "election_id is required" },
      { status: 400 }
    );
  }

  const baseUrl = request.nextUrl.origin;
  const embedUrl = `${baseUrl}/embed/${electionId}`;

  const embedCode = `<iframe
  src="${embedUrl}"
  width="100%"
  height="700"
  frameborder="0"
  style="border: none; max-width: 600px;"
  allow="clipboard-write"
  title="VoteMatch Quiz"
></iframe>`;

  const embedCodeWithTheme = `<iframe
  src="${embedUrl}?theme=light&primaryColor=%23000000"
  width="100%"
  height="700"
  frameborder="0"
  style="border: none; max-width: 600px;"
  allow="clipboard-write"
  title="VoteMatch Quiz"
></iframe>`;

  return NextResponse.json({
    electionId,
    embedUrl,
    embedCode,
    embedCodeWithTheme,
    parameters: {
      theme: "light | dark (default: light)",
      primaryColor: "hex color for primary buttons (default: #000000)",
      hideFooter: "true | false — hide 'Powered by VoteMatch' footer",
      domain: "your-domain.com — required for production embeds",
    },
  });
}
