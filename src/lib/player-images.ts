import type { Player } from "./types";

// 250x250, not the previously-used 110x140 - found live: this CDN also serves a real 250x250
// variant of the same photo (confirmed via direct request, not assumed), which is what every
// large hero render (up to ~400px wide) actually needs; 110x140 upscaled that far read as
// visibly pixelated. Small avatars (down to ~40px) still look fine downscaled from this size.
export function getPlayerImageUrl(player: Pick<Player, "code">) {
  return player.code ? `https://resources.premierleague.com/premierleague/photos/players/250x250/p${player.code}.png` : null;
}
