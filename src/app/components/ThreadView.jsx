"use client";

import { useEffect, useState } from "react";
import { Avatar } from "./Avatar";

function parseFromName(fromHeader) {
  const match = fromHeader.match(/^(.*?)\s*<.*>$/);
  return match ? match[1].replace(/"/g, "") : fromHeader;
}

function isMe(fromHeader, myEmail) {
  return fromHeader.toLowerCase().includes(myEmail.toLowerCase());
}

export default function ThreadView({
  contact,
  myEmail,
  onMessageSent,
  onBack,
  onDeleted,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!contact) return;

    let interval;

    function startPolling() {
      interval = setInterval(loadMessages, 120000); // 2 minutes
    }

    function stopPolling() {
      clearInterval(interval);
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        stopPolling();
      } else {
        loadMessages(); // catch up immediately when tab becomes active again
        startPolling();
      }
    }

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

    fetch("/api/contact/markRead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadIds: contact.threadIds }),
    }).catch(() => {});

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [contact]);

  useEffect(() => {
    setDeleting(false);
  }, [contact]);

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;

    const activeThreadId = contact.threadIds[contact.threadIds.length - 1];

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
      const res = await fetch(`/api/threads/${activeThreadId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("send failed");

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "sent" } : m)),
      );

      const updated = await fetch("/api/contact/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadIds: contact.threadIds }),
      }).then((r) => r.json());

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

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete conversation with ${contactName}? This moves it to Gmail Trash.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/contact/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadIds: contact.threadIds }),
      });
      if (!res.ok) throw new Error("delete failed");
      onDeleted?.(); // parent deselects contact — component will re-render with contact=null
    } catch (err) {
      alert("Failed to delete conversation.");
      setDeleting(false); // only reset here currently — the bug
    }
  }

  if (!contact) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 w-full">
        Select a chat to view messages
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 w-full">
        Loading...
      </div>
    );
  }

  const contactName = parseFromName(contact.from);
  const contactEmail = contact.email;

  return (
    <div className="h-full w-full flex flex-col min-w-0 max-w-full overflow-hidden">
      <div className="h-16 shrink-0 px-4 flex items-center gap-3 border-b border-gray-800">
        <button onClick={onBack} className="md:hidden text-gray-400 shrink-0">
          ←
        </button>
        <Avatar email={contactEmail} name={contactName} size={36} />

        <div className="min-w-0 flex flex-col justify-center flex-1">
          <span className="font-semibold text-sm truncate leading-tight">
            {contactName}
          </span>
          <span className="text-xs text-gray-500 truncate leading-tight">
            {contactEmail}
          </span>
        </div>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-gray-400 hover:text-red-500 shrink-0 disabled:opacity-50 px-2 py-1 cursor-pointer rounded-md hover:bg-zinc-100/10"
          title="Delete conversation"
        >
          {deleting ? "..." : "􀈑"}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="p-4 flex flex-col gap-3 w-full">
          {messages.map((msg) => {
            const fromMe = isMe(msg.from, myEmail);
            return (
              <div
                key={msg.id}
                className={`max-w-[85%] sm:max-w-[70%] px-4 py-2 rounded-2xl whitespace-pre-wrap wrap-break-word text-sm ${
                  fromMe
                    ? "self-end ml-auto bg-[#004E36] text-white"
                    : "self-start bg-[#242626] text-white"
                }`}
                style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
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

      <div className="h-16 shrink-0 px-3 flex items-center gap-2 bg-[#0F0F0F] ">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          className="flex-1 min-w-0 bg-[#272727] rounded-full px-4 py-2 text-sm outline-none"
        />
        <button
          onClick={handleSend}
          className="bg-[#004E36] rounded-full px-2.5 py-2 text-sm font-medium shrink-0 hover:bg-[#004E3690] cursor-pointer"
        >
          􀈠
        </button>
      </div>
    </div>
  );
}
