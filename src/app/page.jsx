import { auth, signIn } from "@/app/auth";
import ChatApp from "@/app/components/ChatApp";

export default async function Home() {
  const session = await auth();

  if (!session) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#1E1E1E]">
        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
        >
          <button
            type="submit"
            className="rounded-md bg-white px-10 py-1.5 text-black font-normal hover:bg-gray-200 cursor-pointer"
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
