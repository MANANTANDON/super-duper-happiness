"use client";

import { useState, useRef } from "react";
import { signOut } from "next-auth/react";
import ChatList from "@/app/components/ChatList";
import ThreadView from "@/app/components/ThreadView";

export default function ChatApp({ userEmail }) {
  const [selectedContact, setSelectedContact] = useState(null);
  const chatListRef = useRef(null);

  return (
    <div className="fixed inset-0 flex bg-black text-white">
      <aside className="w-80 flex flex-col border-r border-gray-800">
        <div className="h-16 shrink-0 px-4 flex items-center justify-between border-b border-gray-800">
          <span className="font-semibold text-sm truncate">{userEmail}</span>
          <button
            onClick={() => signOut()}
            className="text-xs text-gray-500 underline shrink-0 ml-2 cursor-pointer"
          >
            Sign out
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <ChatList
            ref={chatListRef}
            onSelectThread={setSelectedContact}
            selectedId={selectedContact?.email}
          />
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <ThreadView
          contact={selectedContact}
          myEmail={userEmail}
          onMessageSent={() => chatListRef.current?.refresh()}
        />
      </div>
    </div>
  );
}
