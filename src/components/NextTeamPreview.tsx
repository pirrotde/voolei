import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import type { Player, Gender } from "@/lib/volei";

interface NextTeamPreviewProps {
  players: Player[];
}

function GenderBadge({ g }: { g: Gender }) {
  return (
    <Badge
      variant="outline"
      className={
        g === "F"
          ? "border-pink-400 text-pink-600 dark:text-pink-300"
          : "border-blue-400 text-blue-600 dark:text-blue-300"
      }
    >
      {g === "F" ? "F" : "M"}
    </Badge>
  );
}

export function NextTeamPreview({ players }: NextTeamPreviewProps) {
  if (players.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5" />
          Próximo Time
          {players.length < 4 && (
            <span className="text-xs font-normal text-muted-foreground ml-2">
              (faltam {4 - players.length} jogadores)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {players.length < 4 ? (
          <p className="text-sm text-muted-foreground">
            Aguardando mais jogadores na fila para formar o próximo time...
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {players.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-md border px-3 py-2"
              >
                <span className="font-medium">{p.name}</span>
                <GenderBadge g={p.gender} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
