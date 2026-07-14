import { auth } from "@/app/auth";
import { NextResponse } from "next/server";

function getHeader(headers, name) {
  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return header ? header.value : "";
}

function isFromMe(fromHeader, myEmail) {
  return fromHeader.toLowerCase().includes(myEmail.toLowerCase());
}

export async function GET() {
  const session = await auth();

  if (!session || !session.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const myEmail = session.user.email;

  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=15",
    { headers: { Authorization: `Bearer ${session.accessToken}` } },
  );
  const listData = await listRes.json();

  if (!listData.threads) {
    return NextResponse.json({ threads: [] });
  }

  const detailed = await Promise.all(
    listData.threads.map(async (t) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=To`,
        { headers: { Authorization: `Bearer ${session.accessToken}` } },
      );
      const data = await res.json();
      const messages = data.messages || [];
      const lastMessage = messages[messages.length - 1];
      const lastHeaders = lastMessage?.payload?.headers || [];

      // Find the "other party" — the contact name we want shown, regardless of who sent last
      let contactHeader = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        const headers = messages[i].payload?.headers || [];
        const from = getHeader(headers, "From");
        if (from && !isFromMe(from, myEmail)) {
          contactHeader = from;
          break;
        }
      }
      // Fallback: every message in the thread was sent by me (e.g. a note to self) — use "To" instead
      if (!contactHeader) {
        contactHeader =
          getHeader(lastHeaders, "To") || getHeader(lastHeaders, "From");
      }

      return {
        id: t.id,
        snippet: lastMessage?.snippet || t.snippet,
        from: contactHeader,
        subject: getHeader(lastHeaders, "Subject"),
        date: getHeader(lastHeaders, "Date"),
        messageCount: messages.length || 1,
      };
    }),
  );

  return NextResponse.json({ threads: detailed });
}
