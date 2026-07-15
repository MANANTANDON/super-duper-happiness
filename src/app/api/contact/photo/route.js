import { auth } from "@/app/auth";
import { NextResponse } from "next/server";

export async function GET(request) {
  const session = await auth();
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  if (!email) {
    return NextResponse.json({ photoUrl: null });
  }

  try {
    const [contactsRes, otherContactsRes] = await Promise.all([
      fetch(
        `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(email)}&readMask=photos,emailAddresses`,
        { headers: { Authorization: `Bearer ${session.accessToken}` } },
      ),
      fetch(
        `https://people.googleapis.com/v1/otherContacts:search?query=${encodeURIComponent(email)}&readMask=photos,emailAddresses`,
        { headers: { Authorization: `Bearer ${session.accessToken}` } },
      ),
    ]);

    const contactsData = await contactsRes.json();
    const otherData = await otherContactsRes.json();

    const allResults = [
      ...(contactsData.results || []),
      ...(otherData.results || []),
    ];

    for (const result of allResults) {
      const person = result.person;
      const emails = person?.emailAddresses || [];
      const matches = emails.some(
        (e) => e.value?.toLowerCase() === email.toLowerCase(),
      );
      if (matches) {
        // Take the first available photo — don't exclude "default" ones, they're often the real photo
        const photo = person.photos?.[0];
        if (photo?.url) {
          return NextResponse.json({ photoUrl: photo.url });
        }
      }
    }

    return NextResponse.json({ photoUrl: null });
  } catch (err) {
    return NextResponse.json({ photoUrl: null });
  }
}
