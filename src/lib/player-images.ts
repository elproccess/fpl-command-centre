import type { Player } from "./types";

export function getPlayerImageUrl(player: Pick<Player, "code">) {
  return player.code ? `https://resources.premierleague.com/premierleague/photos/players/110x140/p${player.code}.png` : null;
}
