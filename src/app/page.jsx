import { auth, signIn } from "@/app/auth";
import ChatApp from "@/app/components/ChatApp";

export default async function Home() {
  const session = await auth();

  if (!session) {
    return (
      <main className="flex h-screen items-center justify-center bg-black">
        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
        >
          <button
            type="submit"
            className="rounded-lg bg-white px-6 py-3 text-black font-medium hover:bg-gray-200"
          >
            Sign in with Google
          </button>
        </form>
      </main>
    );
  }

  return (
    <ChatApp userEmail={session.user.email} userImage={session.user.image} />
  );
}
