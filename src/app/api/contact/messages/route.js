import { auth } from "@/app/auth";
import { NextResponse } from "next/server";

function getHeader(headers, name) {
  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return header ? header.value : "";
}

function decodeBody(payload) {
  function findPart(part) {
    if (part.mimeType === "text/plain" && part.body?.data)
      return part.body.data;
    if (part.parts) {
      for (const p of part.parts) {
        const found = findPart(p);
        if (found) return found;
      }
    }
    return null;
  }
  let data = null;
  if (payload.mimeType === "text/plain" && payload.body?.data)
    data = payload.body.data;
  else if (payload.parts) data = findPart(payload);
  if (!data) return "";
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    return atob(base64);
  }
}

function stripQuotedText(text) {
  const patterns = [/\r?\nOn [\s\S]+?wrote:\r?\n[\s\S]*/, /\r?\n>.*[\s\S]*/];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      text = text.slice(0, match.index);
      break;
    }
  }
  return text.trim();
}

export async function POST(request) {
  const session = await auth();
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { threadIds } = await request.json();
  if (!Array.isArray(threadIds) || threadIds.length === 0) {
    return NextResponse.json({ messages: [] });
  }

  const allThreads = await Promise.all(
    threadIds.map(async (id) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=full`,
        { headers: { Authorization: `Bearer ${session.accessToken}` } },
      );
      const data = await res.json();
      return (data.messages || []).map((msg) => {
        const headers = msg.payload?.headers || [];
        return {
          id: msg.id,
          threadId: id,
          from: getHeader(headers, "From"),
          to: getHeader(headers, "To"),
          date: getHeader(headers, "Date"),
          subject: getHeader(headers, "Subject"),
          body: stripQuotedText(decodeBody(msg.payload)),
        };
      });
    }),
  );

  const merged = allThreads
    .flat()
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return NextResponse.json({ messages: merged });
}
