"use client";

import { useState, useRef } from "react";
import { signOut } from "next-auth/react";
import ChatList from "@/app/components/ChatList";
import ThreadView from "@/app/components/ThreadView";

export default function ChatApp({ userEmail, userImage }) {
  const [selectedContact, setSelectedContact] = useState(null);
  const chatListRef = useRef(null);

  return (
    <div className="fixed inset-0 flex bg-black text-white overflow-hidden max-w-full">
      <aside
        className={`w-full md:w-80 flex-col border-r border-gray-800 shrink-0 ${
          selectedContact ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="h-16 shrink-0 px-4 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-2 min-w-0">
            {userImage ? (
              <img
                src={userImage}
                alt="me"
                className="w-8 h-8 rounded-full shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-700 shrink-0" />
            )}
            <span className="font-semibold text-sm truncate">{userEmail}</span>
          </div>
          <button
            onClick={() => signOut()}
            className="text-xs text-gray-500 underline shrink-0 ml-2"
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

      <div
        className={`w-full md:flex-1 md:min-w-0 min-w-0 overflow-hidden ${
          selectedContact ? "flex" : "hidden md:flex"
        }`}
      >
        <ThreadView
          contact={selectedContact}
          myEmail={userEmail}
          onBack={() => setSelectedContact(null)}
          onMessageSent={() => chatListRef.current?.refresh()}
        />
      </div>
    </div>
  );
}
