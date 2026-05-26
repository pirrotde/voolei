import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Trophy, Shuffle, UserPlus, RotateCcw, LogOut } from "lucide-react";
import {
  buildTeam,
  loadState,
  pickTeam,
  saveState,
  uid,
  type Gender,
  type Player,
  type State,
  type Team,
} from "@/lib/volei";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [state, setState] = useState<State>(() => ({
    players: [],
    queue: [],
    teamA: null,
    teamB: null,
    history: [],
  }));
  const [hydrated, setHydrated] = useState(false);

  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("M");

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  const byId = useMemo(() => {
    const m: Record<string, Player> = {};
    for (const p of state.players) m[p.id] = p;
    return m;
  }, [state.players]);

  const inCourt = useMemo(() => {
    const s = new Set<string>();
    state.teamA?.players.forEach((p) => s.add(p.id));
    state.teamB?.players.forEach((p) => s.add(p.id));
    return s;
  }, [state.teamA, state.teamB]);

  function addPlayer() {
    const n = name.trim();
    if (!n) return;
    const p: Player = { id: uid(), name: n, gender };
    setState((s) => ({
      ...s,
      players: [...s.players, p],
      queue: [...s.queue, p.id],
    }));
    setName("");
  }

  function removePlayer(id: string) {
    setState((s) => ({
      ...s,
      players: s.players.filter((p) => p.id !== id),
      queue: s.queue.filter((q) => q !== id),
      teamA: s.teamA
        ? { ...s.teamA, players: s.teamA.players.filter((p) => p.id !== id) }
        : null,
      teamB: s.teamB
        ? { ...s.teamB, players: s.teamB.players.filter((p) => p.id !== id) }
        : null,
    }));
  }

  function toggleInQueue(id: string) {
    setState((s) => {
      if (s.queue.includes(id)) {
        return { ...s, queue: s.queue.filter((q) => q !== id) };
      }
      return { ...s, queue: [...s.queue, id] };
    });
  }

  function startMatch() {
    setState((s) => {
      if (s.teamA && s.teamB) return s;
      let queue = [...s.queue];
      let teamA = s.teamA;
      let teamB = s.teamB;

      if (!teamA) {
        const r = pickTeam(queue, byId);
        if (!r) return s;
        teamA = buildTeam(r.teamIds, byId);
        queue = r.rest;
      }
      if (!teamB) {
        const r = pickTeam(queue, byId);
        if (!r) return { ...s, teamA, queue };
        teamB = buildTeam(r.teamIds, byId);
        queue = r.rest;
      }
      return { ...s, teamA, teamB, queue };
    });
  }

  function declareWinner(winner: "A" | "B") {
    setState((s) => {
      if (!s.teamA || !s.teamB) return s;
      const win = winner === "A" ? s.teamA : s.teamB;
      const lose = winner === "A" ? s.teamB : s.teamA;

      // perdedores vão para o fim da fila (ordem mantida)
      const newQueue = [...s.queue, ...lose.players.map((p) => p.id)];

      // monta novo time desafiante
      const r = pickTeam(newQueue, byId);
      const newChallenger: Team | null = r ? buildTeam(r.teamIds, byId) : null;
      const restQueue = r ? r.rest : newQueue;

      return {
        ...s,
        teamA: winner === "A" ? win : newChallenger,
        teamB: winner === "B" ? win : newChallenger,
        queue: restQueue,
        history: [
          {
            winnerNames: win.players.map((p) => p.name),
            loserNames: lose.players.map((p) => p.name),
            at: Date.now(),
          },
          ...s.history,
        ].slice(0, 30),
      };
    });
  }

  function resetCourt() {
    setState((s) => {
      const ids: string[] = [];
      s.teamA?.players.forEach((p) => ids.push(p.id));
      s.teamB?.players.forEach((p) => ids.push(p.id));
      return { ...s, teamA: null, teamB: null, queue: [...s.queue, ...ids] };
    });
  }

  function reshuffleAll() {
    setState((s) => {
      const all = [
        ...(s.teamA?.players.map((p) => p.id) ?? []),
        ...(s.teamB?.players.map((p) => p.id) ?? []),
        ...s.queue,
      ];
      // embaralha mantendo mulheres distribuídas: simples shuffle
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }
      return { ...s, teamA: null, teamB: null, queue: all };
    });
  }

  const queuePlayers = state.queue.map((id) => byId[id]).filter(Boolean);
  const benchPlayers = state.players.filter(
    (p) => !state.queue.includes(p.id) && !inCourt.has(p.id),
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              🏐 Vôlei da Galera
            </h1>
            <p className="text-sm text-muted-foreground">
              Times de 4 · 1 mulher por time · rotação automática
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Coluna principal: quadra + histórico */}
        <section className="space-y-6">
          {/* Quadra */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Quadra</CardTitle>
              <div className="flex gap-2">
                {!(state.teamA && state.teamB) && (
                  <Button size="sm" onClick={startMatch}>
                    <Shuffle className="size-4 mr-1" /> Montar times
                  </Button>
                )}
                {(state.teamA || state.teamB) && (
                  <Button size="sm" variant="outline" onClick={resetCourt}>
                    <RotateCcw className="size-4 mr-1" /> Limpar quadra
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <TeamCard
                label="Time A"
                team={state.teamA}
                onWin={() => declareWinner("A")}
                canDeclare={!!(state.teamA && state.teamB)}
              />
              <TeamCard
                label="Time B"
                team={state.teamB}
                onWin={() => declareWinner("B")}
                canDeclare={!!(state.teamA && state.teamB)}
              />
            </CardContent>
          </Card>

          {/* Fila */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Fila ({queuePlayers.length})</CardTitle>
              <Button size="sm" variant="ghost" onClick={reshuffleAll}>
                <Shuffle className="size-4 mr-1" /> Embaralhar tudo
              </Button>
            </CardHeader>
            <CardContent>
              {queuePlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ninguém na fila. Cadastre jogadores ao lado.
                </p>
              ) : (
                <ol className="grid gap-2 sm:grid-cols-2">
                  {queuePlayers.map((p, i) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-5">
                          {i + 1}
                        </span>
                        <span className="font-medium">{p.name}</span>
                        <GenderBadge g={p.gender} />
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleInQueue(p.id)}
                      >
                        Sair
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Histórico */}
          {state.history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Últimas partidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {state.history.map((h, i) => (
                  <div
                    key={i}
                    className="text-sm flex flex-wrap gap-x-2 gap-y-1 border-b last:border-0 pb-2 last:pb-0"
                  >
                    <Trophy className="size-4 text-yellow-500" />
                    <span className="font-medium">
                      {h.winnerNames.join(", ")}
                    </span>
                    <span className="text-muted-foreground">venceu</span>
                    <span>{h.loserNames.join(", ")}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>

        {/* Coluna lateral: cadastro */}
        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Adicionar jogador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPlayer()}
              />
              <Select
                value={gender}
                onValueChange={(v) => setGender(v as Gender)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Homem</SelectItem>
                  <SelectItem value="F">Mulher</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addPlayer} className="w-full">
                <UserPlus className="size-4 mr-1" /> Adicionar à fila
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Jogadores ({state.players.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {state.players.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum jogador cadastrado.
                </p>
              )}
              {state.players.map((p) => {
                const inQ = state.queue.includes(p.id);
                const onCourt = inCourt.has(p.id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      <GenderBadge g={p.gender} />
                      {onCourt && (
                        <Badge variant="secondary" className="text-[10px]">
                          em quadra
                        </Badge>
                      )}
                    </span>
                    <span className="flex gap-1">
                      {!onCourt && (
                        <Button
                          size="sm"
                          variant={inQ ? "secondary" : "outline"}
                          onClick={() => toggleInQueue(p.id)}
                        >
                          {inQ ? "Tirar" : "Pra fila"}
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removePlayer(p.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </span>
                  </div>
                );
              })}
              {benchPlayers.length > 0 && (
                <p className="text-xs text-muted-foreground pt-1">
                  {benchPlayers.length} fora da fila
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
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

function TeamCard({
  label,
  team,
  onWin,
  canDeclare,
}: {
  label: string;
  team: Team | null;
  onWin: () => void;
  canDeclare: boolean;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{label}</h3>
        {team && canDeclare && (
          <Button size="sm" onClick={onWin}>
            <Trophy className="size-4 mr-1" /> Venceu
          </Button>
        )}
      </div>
      {!team ? (
        <p className="text-sm text-muted-foreground">
          Sem time. Clique em “Montar times”.
        </p>
      ) : (
        <ul className="space-y-1">
          {team.players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <span className="font-medium">{p.name}</span>
              <GenderBadge g={p.gender} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
