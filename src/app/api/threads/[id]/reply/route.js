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

function base64urlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const myEmail = session.user.email;
  const { id } = await params;
  const { text } = await request.json();

  const threadRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } },
  );
  const threadData = await threadRes.json();
  const messages = threadData.messages || [];
  const lastMsg = messages[messages.length - 1];
  const lastHeaders = lastMsg.payload.headers;

  // Find the correct recipient: walk backwards to the most recent message NOT from me
  let to = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const headers = messages[i].payload.headers;
    const from = getHeader(headers, "From");
    if (from && !isFromMe(from, myEmail)) {
      to = from;
      break;
    }
  }
  // Fallback: if every message was from me, reply to whoever "To" was on the last message
  if (!to) {
    to = getHeader(lastHeaders, "To");
  }

  const subject = getHeader(lastHeaders, "Subject");
  const messageId = getHeader(lastHeaders, "Message-ID");
  const references = getHeader(lastHeaders, "References");

  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

  const rawEmail = [
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${messageId}`,
    `References: ${references ? references + " " : ""}${messageId}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    text,
  ].join("\r\n");

  const encodedMessage = base64urlEncode(rawEmail);

  const sendRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: encodedMessage,
        threadId: id,
      }),
    },
  );

  const sendData = await sendRes.json();

  if (!sendRes.ok) {
    return NextResponse.json({ error: sendData }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: sendData });
}
