"use client";

import { useEffect, useState } from "react";

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
    "bg-violet-600",
    "bg-pink-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export const Avatar = ({ email, name, size = 36 }) => {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    fetch(`/api/contact/photo?email=${encodeURIComponent(email)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setPhotoUrl(data.photoUrl || null);
          setChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  const dimension = `${size}px`;

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="rounded-full shrink-0 object-cover"
        style={{ width: dimension, height: dimension }}
        onError={() => setPhotoUrl(null)} // fallback if the image URL fails to load
      />
    );
  }

  return (
    <div
      className={`rounded-full shrink-0 flex items-center justify-center font-semibold text-white ${getAvatarColor(
        name || "?",
      )}`}
      style={{ width: dimension, height: dimension, fontSize: size * 0.4 }}
    >
      {getInitial(name)}
    </div>
  );
};
