"use client";

import {
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";

function parseFromName(fromHeader) {
  const match = fromHeader.match(/^(.*?)\s*<.*>$/);
  return match ? match[1].replace(/"/g, "") : fromHeader;
}

function parseFromEmail(fromHeader) {
  const match = fromHeader.match(/<(.+)>/);
  return match ? match[1].toLowerCase() : fromHeader.toLowerCase();
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Heuristic: is this sender likely a newsletter/automated mail, not a real person?
function isLikelyNewsletter(fromHeader) {
  const email = parseFromEmail(fromHeader);
  const patterns = [
    "noreply",
    "no-reply",
    "donotreply",
    "do-not-reply",
    "notifications",
    "notification",
    "newsletter",
    "digest",
    "alerts",
    "jobalert",
    "updates",
    "marketing",
    "mailer",
  ];
  return patterns.some((p) => email.includes(p));
}

const ChatList = forwardRef(function ChatList(
  { onSelectThread, selectedId },
  ref,
) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [hideNewsletters, setHideNewsletters] = useState(false);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/threads");
      if (!res.ok) return;
      const data = await res.json();
      setThreads(data.threads || []);
    } catch (err) {
      console.warn("Poll failed, will retry:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    refresh: fetchThreads,
  }));

  useEffect(() => {
    fetchThreads();
    const interval = setInterval(fetchThreads, 15000);
    return () => clearInterval(interval);
  }, [fetchThreads]);

  const filtered = threads.filter((thread) => {
    if (hideNewsletters && isLikelyNewsletter(thread.from)) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const name = parseFromName(thread.from).toLowerCase();
      const subject = (thread.subject || "").toLowerCase();
      const snippet = (thread.snippet || "").toLowerCase();
      if (!name.includes(q) && !subject.includes(q) && !snippet.includes(q)) {
        return false;
      }
    }
    return true;
  });

  if (loading) {
    return <div className="p-4 text-gray-400 text-sm">Loading chats...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-800 flex flex-col gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats..."
          className="bg-gray-900 rounded-full px-4 py-2 text-sm outline-none"
        />
        <label className="flex items-center gap-2 text-xs text-gray-400 px-1">
          <input
            type="checkbox"
            checked={hideNewsletters}
            onChange={(e) => setHideNewsletters(e.target.checked)}
          />
          Hide newsletters & alerts
        </label>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-4 text-gray-500 text-sm">No chats match.</div>
        )}
        {filtered.map((thread) => (
          <button
            key={thread.id}
            onClick={() => onSelectThread(thread.id)}
            className={`flex flex-col items-start text-left px-4 py-3 border-b border-gray-800 hover:bg-gray-900 transition w-full ${
              selectedId === thread.id ? "bg-gray-900" : ""
            }`}
          >
            <div className="flex justify-between w-full">
              <span className="font-medium text-white truncate max-w-[70%]">
                {parseFromName(thread.from)}
              </span>
              <span className="text-xs text-gray-500 shrink-0">
                {formatDate(thread.date)}
              </span>
            </div>
            <span className="text-sm text-gray-300 truncate w-full">
              {thread.subject}
            </span>
            <span className="text-xs text-gray-500 truncate w-full">
              {thread.snippet}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
});

export default ChatList;
