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

function extractEmail(header) {
  const match = header.match(/<(.+)>/);
  return (match ? match[1] : header).toLowerCase().trim();
}

export async function GET() {
  const session = await auth();
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const myEmail = session.user.email;

  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=25",
    { headers: { Authorization: `Bearer ${session.accessToken}` } },
  );
  const listData = await listRes.json();
  if (!listData.threads) return NextResponse.json({ contacts: [] });

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

      let contactHeader = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        const headers = messages[i].payload?.headers || [];
        const from = getHeader(headers, "From");
        if (from && !isFromMe(from, myEmail)) {
          contactHeader = from;
          break;
        }
      }
      if (!contactHeader) {
        contactHeader =
          getHeader(lastHeaders, "To") || getHeader(lastHeaders, "From");
      }

      return {
        threadId: t.id,
        snippet: lastMessage?.snippet || t.snippet,
        from: contactHeader,
        subject: getHeader(lastHeaders, "Subject"),
        date: getHeader(lastHeaders, "Date"),
        labels: lastMessage?.labelIds || [],
      };
    }),
  );

  // Group threads by contact email — one "chat" per person, not per subject line
  const byContact = new Map();
  for (const t of detailed) {
    const email = extractEmail(t.from);
    const existing = byContact.get(email);
    if (!existing || new Date(t.date) > new Date(existing.date)) {
      byContact.set(email, {
        email,
        from: t.from,
        subject: t.subject,
        snippet: t.snippet,
        date: t.date,
        labels: t.labels,
        threadIds: existing
          ? [...existing.threadIds, t.threadId]
          : [t.threadId],
      });
    } else {
      existing.threadIds.push(t.threadId);
    }
  }

  const contacts = Array.from(byContact.values()).sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  return NextResponse.json({ contacts });
}
