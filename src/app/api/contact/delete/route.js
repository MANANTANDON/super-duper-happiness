import { auth } from "@/app/auth";
import { NextResponse } from "next/server";

export async function POST(request) {
  const session = await auth();
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { threadIds } = await request.json();
  if (!Array.isArray(threadIds) || threadIds.length === 0) {
    return NextResponse.json(
      { error: "No threadIds provided" },
      { status: 400 },
    );
  }

  try {
    const results = await Promise.all(
      threadIds.map((id) =>
        fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}/trash`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${session.accessToken}` },
          },
        ),
      ),
    );

    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      return NextResponse.json(
        { error: "Some threads failed to delete" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
