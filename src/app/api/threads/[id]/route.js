import { auth } from "@/app/auth";
import { NextResponse } from "next/server";

function getHeader(headers, name) {
  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return header ? header.value : "";
}

function decodeBody(payload) {
  // Find the plain text part, decode from base64url
  function findPart(part) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return part.body.data;
    }
    if (part.parts) {
      for (const p of part.parts) {
        const found = findPart(p);
        if (found) return found;
      }
    }
    return null;
  }

  let data = null;
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    data = payload.body.data;
  } else if (payload.parts) {
    data = findPart(payload);
  }

  if (!data) return "";

  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    return atob(base64);
  }
}

function stripQuotedText(text) {
  const patterns = [
    /\r?\nOn [\s\S]+?wrote:\r?\n[\s\S]*/, // "On ... wrote:" possibly spanning multiple lines
    /\r?\n>.*[\s\S]*/, // fallback: lines starting with >
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      text = text.slice(0, match.index);
      break;
    }
  }
  return text.trim();
}
export async function GET(request, { params }) {
  const session = await auth();
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=full`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } },
  );
  const data = await res.json();

  const messages = (data.messages || []).map((msg) => {
    const headers = msg.payload?.headers || [];
    return {
      id: msg.id,
      from: getHeader(headers, "From"),
      to: getHeader(headers, "To"),
      date: getHeader(headers, "Date"),
      subject: getHeader(headers, "Subject"),
      body: stripQuotedText(decodeBody(msg.payload)),
    };
  });

  return NextResponse.json({ messages });
}
