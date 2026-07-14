"use client";

import { useEffect, useState } from "react";

function parseFromName(fromHeader) {
  const match = fromHeader.match(/^(.*?)\s*<.*>$/);
  return match ? match[1].replace(/"/g, "") : fromHeader;
}

function parseFromEmail(fromHeader) {
  const match = fromHeader.match(/<(.+)>/);
  return match ? match[1] : fromHeader;
}

function isMe(fromHeader, myEmail) {
  return fromHeader.toLowerCase().includes(myEmail.toLowerCase());
}

function findContactHeader(messages, myEmail) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (!isMe(messages[i].from, myEmail)) {
      return messages[i].from;
    }
  }
  return messages[0]?.from || "";
}

function getInitial(name) {
  return name?.trim()?.[0]?.toUpperCase() || "?";
}

function getAvatarColor(name) {
  const colors = [
    "bg-rose-600",
    "bg-orange-600",
    "bg-amber-600",
    "bg-emerald-600",
    "bg-teal-600",
    "bg-sky-600",
    "bg-indigo-600",
    "bg-violet-600",
    "bg-pink-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function ThreadView({ contact, myEmail, onMessageSent }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!contact) return;
    async function loadMessages() {
      try {
        const res = await fetch("/api/contact/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadIds: contact.threadIds }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setMessages((prev) => {
          const stillSending = prev.filter((m) => m.status === "sending");
          return [...(data.messages || []), ...stillSending];
        });
      } catch (err) {
        console.warn("Poll failed:", err.message);
      } finally {
        setLoading(false);
      }
    }
    setLoading(true);
    loadMessages();
    const interval = setInterval(loadMessages, 8000);
    return () => clearInterval(interval);
  }, [contact]);

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      from: myEmail,
      body: text,
      date: new Date().toISOString(),
      status: "sending",
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setDraft("");

    try {
      const res = await fetch(`/api/threads/${contact}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("send failed");

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "sent" } : m)),
      );

      const updated = await fetch(`/api/threads/${contact}`).then((r) =>
        r.json(),
      );
      setMessages((prev) => {
        const real = updated.messages || [];
        const stillPending = prev.filter(
          (m) => m.status === "sending" && m.id !== tempId,
        );
        return [...real, ...stillPending];
      });

      onMessageSent?.();
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)),
      );
    }
  }

  if (!contact) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Select a chat to view messages
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  const contactHeader = messages.length
    ? findContactHeader(messages, myEmail)
    : "";
  const contactName = parseFromName(contactHeader);
  const contactEmail = parseFromEmail(contactHeader);

  return (
    <div className="h-full flex flex-col">
      <div className="h-16 shrink-0 px-4 flex items-center gap-3 border-b border-gray-800">
        <div
          className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold text-white ${getAvatarColor(
            contactName,
          )}`}
        >
          {getInitial(contactName)}
        </div>
        <div className="min-w-0 flex flex-col justify-center">
          <span className="font-semibold text-sm truncate leading-tight">
            {contactName}
          </span>
          <span className="text-xs text-gray-500 truncate leading-tight">
            {contactEmail}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 flex flex-col gap-3">
          {messages.map((msg) => {
            const fromMe = isMe(msg.from, myEmail);
            return (
              <div
                key={msg.id}
                className={`max-w-[70%] px-4 py-2 rounded-2xl whitespace-pre-wrap wrap-break-word text-sm ${
                  fromMe
                    ? "self-end ml-auto bg-blue-600 text-white"
                    : "self-start bg-gray-800 text-white"
                }`}
              >
                <div>{msg.body || "(no plain text content)"}</div>
                {fromMe && msg.status && (
                  <div className="text-[10px] mt-1 text-right opacity-70">
                    {msg.status === "sending" && "Sending..."}
                    {msg.status === "sent" && "Sent ✓"}
                    {msg.status === "failed" && "Failed to send ⚠"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-16 shrink-0 px-3 flex items-center gap-2 border-t border-gray-800">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          className="flex-1 bg-gray-900 rounded-full px-4 py-2 text-sm outline-none"
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 rounded-full px-5 py-2 text-sm font-medium"
        >
          Send
        </button>
      </div>
    </div>
  );
}
