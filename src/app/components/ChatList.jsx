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
  // "primary" = anything NOT in promotions/updates/social/forums
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

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/threads");
      if (!res.ok) return;
      const data = await res.json();
      setThreads(data.contacts || []);
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
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
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
            onClick={() => onSelectThread(thread)}
            className={`flex flex-col cursor-pointer items-start text-left px-4 py-3 border-b border-gray-800 hover:bg-gray-900 transition w-full ${selectedId === thread.email ? "bg-gray-900" : ""}`}
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
