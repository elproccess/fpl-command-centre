"use client";

import Image from "next/image";
import { useState } from "react";
import type { Player } from "@/lib/types";
import { getPlayerImageUrl } from "@/lib/player-images";

// The shirt CDN keys images by each club's stable "team_code" (from the FPL bootstrap
// element's raw team_code field), NOT the season's 1-20 team id - team ids get reassigned
// every season on promotion/relegation, but team_code stays fixed for a club permanently.
// Confirmed directly against the backend's Player.raw_bootstrap.team_code for one player per
// team (e.g. team_id 12 this season is Liverpool, whose stable team_code is 14 - shirt_12-*
// 404s, shirt_14-* is the real Liverpool shirt).
const TEAM_CODES: Record<string, number> = {
  ARS: 3,
  AVL: 7,
  BUR: 90,
  BOU: 91,
  BRE: 94,
  BHA: 36,
  CHE: 8,
  CRY: 31,
  EVE: 11,
  FUL: 54,
  LEE: 2,
  LIV: 14,
  MCI: 43,
  MUN: 1,
  NEW: 4,
  NFO: 17,
  SUN: 56,
  TOT: 6,
  WHU: 21,
  WOL: 39,
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

// The same diagonal-shaded kit render the official FPL site and every fantasy tool uses -
// fantasy.premierleague.com/dist/img/shirts/standard/shirt_{team_id}-{size}.png, with a "_1"
// suffix on the team id for the goalkeeper's distinct kit.
export function TeamShirtImage({
  team,
  position,
  className = "",
  size = 110,
  onError,
}: {
  team: string;
  position?: string;
  className?: string;
  size?: 66 | 110;
  onError?: () => void;
}) {
  const teamCode = TEAM_CODES[team];
  if (!teamCode) return null;
  const shirtCode = position === "GK" ? `${teamCode}_1` : String(teamCode);

  return (
    <Image
      src={`https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${shirtCode}-${size}.png`}
      alt={`${team} shirt`}
      width={size}
      height={size}
      className={className}
      onError={onError}
    />
  );
}

function InitialsAvatar({ player, className = "" }: { player: Player; className?: string }) {
  return (
    <span className={`grid place-items-center rounded-full bg-[#6C1DFF] text-sm font-black text-white ${className}`}>
      {initials(player.name)}
    </span>
  );
}

export function PlayerVisual({ player, size = "md", preferPhoto = true }: { player: Player; size?: "sm" | "md" | "lg" | "xl"; preferPhoto?: boolean }) {
  const [fallback, setFallback] = useState<"photo" | "shirt" | "initials">(preferPhoto && player.code ? "photo" : "shirt");
  const sizes = {
    sm: "h-10 w-10",
    md: "h-14 w-14",
    lg: "h-20 w-20",
    xl: "h-28 w-24",
  };
  const photo = getPlayerImageUrl(player);
  const hasKnownKit = Boolean(TEAM_CODES[player.team]);

  if (fallback === "photo" && photo) {
    return (
      <span className={`relative block shrink-0 overflow-hidden rounded-xl bg-[#F8F5FF] ${sizes[size]}`}>
        <Image
          src={photo}
          alt={`${player.name} player photo`}
          fill
          sizes={size === "xl" ? "96px" : size === "lg" ? "80px" : size === "md" ? "56px" : "40px"}
          className="h-full w-full object-cover object-top"
          onError={() => setFallback("shirt")}
        />
      </span>
    );
  }

  if (fallback === "shirt" && hasKnownKit) {
    return (
      <span className={`grid shrink-0 place-items-center rounded-xl bg-[#F8F5FF] p-1 ${sizes[size]}`}>
        <TeamShirtImage
          team={player.team}
          position={player.position}
          size={size === "sm" ? 66 : 110}
          className="h-full w-full object-contain drop-shadow-md"
          onError={() => setFallback("initials")}
        />
      </span>
    );
  }

  return <InitialsAvatar player={player} className={sizes[size]} />;
}
