"use client";

import {
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Avatar } from "./Avatar";

function parseFromName(fromHeader) {
  const match = fromHeader.match(/^(.*?)\s*<.*>$/);
  return match ? match[1].replace(/"/g, "") : fromHeader;
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

const TABS = [
  { key: "primary", label: "Chats" },
  { key: "updates", label: "Alerts" },
  { key: "promotions", label: "Promotions" },
  { key: "all", label: "All" },
];

function matchesTab(thread, tab) {
  const labels = thread.labels || [];
  if (tab === "all") return true;
  if (tab === "promotions") return labels.includes("CATEGORY_PROMOTIONS");
  if (tab === "updates") {
    return (
      labels.includes("CATEGORY_UPDATES") ||
      labels.includes("CATEGORY_FORUMS") ||
      labels.includes("CATEGORY_SOCIAL")
    );
  }
  return (
    !labels.includes("CATEGORY_PROMOTIONS") &&
    !labels.includes("CATEGORY_UPDATES") &&
    !labels.includes("CATEGORY_FORUMS") &&
    !labels.includes("CATEGORY_SOCIAL")
  );
}

const ChatList = forwardRef(function ChatList(
  { onSelectThread, selectedId },
  ref,
) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("primary");
  // Emails we've locally marked read, so a poll landing mid-flight can't flash the dot back
  const [locallyRead, setLocallyRead] = useState(() => new Set());

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/threads");
      if (!res.ok) return;
      const data = await res.json();
      const contacts = data.contacts || [];
      setThreads(
        contacts.map((c) =>
          locallyRead.has(c.email) ? { ...c, unread: false } : c,
        ),
      );
    } catch (err) {
      console.warn("Poll failed, will retry:", err.message);
    } finally {
      setLoading(false);
    }
  }, [locallyRead]);

  useImperativeHandle(ref, () => ({
    refresh: fetchThreads,
  }));

  useEffect(() => {
    fetchThreads();
    const interval = setInterval(fetchThreads, 15000);
    return () => clearInterval(interval);
  }, [fetchThreads]);

  function handleSelect(thread) {
    setLocallyRead((prev) => new Set(prev).add(thread.email));
    setThreads((prev) =>
      prev.map((t) => (t.email === thread.email ? { ...t, unread: false } : t)),
    );
    onSelectThread(thread);
  }

  const filtered = threads.filter((thread) => {
    if (!matchesTab(thread, activeTab)) return false;
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
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition shrink-0 ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-900 text-gray-400 hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-4 text-gray-500 text-sm">No chats match.</div>
        )}
        {filtered.map((thread) => (
          <button
            key={thread.email}
            onClick={() => handleSelect(thread)}
            className={`flex items-center gap-3 cursor-pointer text-left px-4 py-3 border-b border-gray-800 hover:bg-gray-900 transition w-full ${
              selectedId === thread.email ? "bg-gray-900" : ""
            }`}
          >
            <Avatar
              email={thread.email}
              name={parseFromName(thread.from)}
              size={40}
            />

            <div className="flex flex-col items-start flex-1 min-w-0">
              <div className="flex justify-between w-full">
                <span
                  className={`truncate max-w-[65%] ${
                    thread.unread
                      ? "font-bold text-white"
                      : "font-medium text-gray-200"
                  }`}
                >
                  {parseFromName(thread.from)}
                </span>
                <span className="text-xs text-gray-500 shrink-0">
                  {formatDate(thread.date)}
                </span>
              </div>
              <span
                className={`text-xs truncate w-full ${
                  thread.unread ? "text-gray-200" : "text-gray-500"
                }`}
              >
                {thread.snippet}
              </span>
            </div>

            {thread.unread && (
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 ml-1" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
});

export default ChatList;
