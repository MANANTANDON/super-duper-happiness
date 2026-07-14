"use client";

import { useEffect, useState } from "react";

function parseFromName(fromHeader) {
  const match = fromHeader.match(/^(.*?)\s*<.*>$/);
  return match ? match[1].replace(/"/g, "") : fromHeader;
}

function isMe(fromHeader, myEmail) {
  return fromHeader.toLowerCase().includes(myEmail.toLowerCase());
}

export default function ThreadView({ threadId, myEmail, onMessageSent }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!threadId) return;

    async function loadMessages() {
      try {
        const res = await fetch(`/api/threads/${threadId}`);
        if (!res.ok) return;
        const data = await res.json();
        // Keep any optimistic "sending" bubbles that haven't resolved yet
        setMessages((prev) => {
          const stillSending = prev.filter((m) => m.status === "sending");
          return [...(data.messages || []), ...stillSending];
        });
      } catch (err) {
        console.warn("Poll failed, will retry:", err.message);
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    loadMessages();
    const interval = setInterval(loadMessages, 8000);
    return () => clearInterval(interval);
  }, [threadId]);

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      from: myEmail,
      body: text,
      date: new Date().toISOString(),
      status: "sending", // sending -> sent -> failed
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setDraft("");

    try {
      const res = await fetch(`/api/threads/${threadId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("send failed");

      // Mark the optimistic bubble as sent
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "sent" } : m)),
      );

      // Refetch real thread data in the background to reconcile
      const updated = await fetch(`/api/threads/${threadId}`).then((r) =>
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

  if (!threadId) {
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

  return (
    <div className="h-full flex flex-col">
      <div className="h-16 shrink-0 px-4 flex items-center border-b border-gray-800">
        <span className="font-semibold">
          {messages[0] ? parseFromName(messages[0].from) : ""}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 flex flex-col gap-3">
          {messages.map((msg) => {
            const fromMe = isMe(msg.from, myEmail);
            return (
              <div
                key={msg.id}
                className={`max-w-[70%] px-4 py-2 rounded-2xl whitespace-pre-wrap break-words text-sm ${
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
