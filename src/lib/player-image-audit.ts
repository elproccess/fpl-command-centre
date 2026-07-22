import type { Player } from "./types";
import { getPlayerImageUrl } from "./player-images";

export function auditPlayerImageMappings(players: Player[]) {
  return players.map((player) => ({
    web_name: player.name,
    id: player.id,
    code: player.code ?? null,
    image_url: getPlayerImageUrl(player),
  }));
}
