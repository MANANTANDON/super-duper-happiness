import { auth } from "@/app/auth";
import { NextResponse } from "next/server";

export async function POST(request) {
  const session = await auth();
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { threadIds } = await request.json();
  if (!Array.isArray(threadIds) || threadIds.length === 0) {
    return NextResponse.json({ success: true });
  }

  await Promise.all(
    threadIds.map((id) =>
      fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}/modify`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
        },
      ),
    ),
  );

  return NextResponse.json({ success: true });
}
