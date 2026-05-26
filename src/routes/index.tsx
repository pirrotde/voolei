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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Trash2,
  Trophy,
  Shuffle,
  UserPlus,
  RotateCcw,
  LogOut,
  Minus,
  Plus,
  Undo2,
  TrashIcon,
} from "lucide-react";
import {
  buildTeam,
  currentTarget,
  loadState,
  pickTeam,
  saveState,
  uid,
  type Gender,
  type Player,
  type State,
  type Team,
} from "@/lib/volei";
import { NextTeamPreview } from "@/components/NextTeamPreview";
import { loadStateFn, saveStateFn } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  // Usa uma sala padrão fixa para todos
  const [roomId] = useState<string>("default-room");

  const [state, setState] = useState<State>(() => ({
    players: [],
    queue: [],
    teamA: null,
    teamB: null,
    scoreA: 0,
    scoreB: 0,
    maxConsecutiveWins: 3,
    currentWinStreak: 0,
    championTeamId: null,
    history: [],
  }));
  const [hydrated, setHydrated] = useState(false);
  const [showWinConfirmation, setShowWinConfirmation] = useState<"A" | "B" | null>(null);

  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("M");

  // Carrega estado do banco
  useEffect(() => {
    loadStateFn(roomId)
      .then((roomState: State) => {
        setState(roomState);
        setHydrated(true);
      })
      .catch((err: unknown) => {
        console.error("Erro ao carregar estado:", err);
        // Se der erro, carrega do localStorage como fallback
        setState(loadState());
        setHydrated(true);
      });
  }, [roomId]);

  // Salva estado no banco
  useEffect(() => {
    if (!hydrated) return;

    // Salva no banco (debounce para evitar muitas chamadas)
    const timer = setTimeout(() => {
      saveStateFn(roomId, state).catch((err: unknown) => {
        console.error("Erro ao salvar estado:", err);
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [state, hydrated, roomId]);

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

  const target = currentTarget(state.scoreA, state.scoreB);

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
    setState((s) => {
      const newPlayers = s.players.filter((p) => p.id !== id);
      const newQueue = s.queue.filter((q) => q !== id);

      const inTeamA = s.teamA?.players.some((p) => p.id === id);
      const inTeamB = s.teamB?.players.some((p) => p.id === id);

      if (!inTeamA && !inTeamB) {
        return { ...s, players: newPlayers, queue: newQueue };
      }

      let returningIds: string[] = [];
      let teamA = s.teamA;
      let teamB = s.teamB;
      let scoreA = s.scoreA;
      let scoreB = s.scoreB;

      if (inTeamA && teamA) {
        returningIds = teamA.players
          .filter((p) => p.id !== id)
          .map((p) => p.id);
        teamA = null;
        scoreA = 0;
        scoreB = 0;
      } else if (inTeamB && teamB) {
        returningIds = teamB.players
          .filter((p) => p.id !== id)
          .map((p) => p.id);
        teamB = null;
        scoreA = 0;
        scoreB = 0;
      }

      return {
        ...s,
        players: newPlayers,
        queue: [...newQueue, ...returningIds],
        teamA,
        teamB,
        scoreA,
        scoreB,
      };
    });
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
        if (!r) return { ...s, teamA, queue, scoreA: 0, scoreB: 0, currentWinStreak: 0, championTeamId: null };
        teamB = buildTeam(r.teamIds, byId);
        queue = r.rest;
      }
      // Reseta contador e campeão quando monta novos times
      return { ...s, teamA, teamB, queue, scoreA: 0, scoreB: 0, currentWinStreak: 0, championTeamId: null };
    });
  }

  function changeScore(team: "A" | "B", delta: number) {
    setState((s) => {
      if (!s.teamA || !s.teamB) return s;
      const scoreA = team === "A" ? Math.max(0, s.scoreA + delta) : s.scoreA;
      const scoreB = team === "B" ? Math.max(0, s.scoreB + delta) : s.scoreB;
      const tgt = currentTarget(scoreA, scoreB);

      // Ao atingir o alvo, mostra confirmação ao invés de finalizar automático
      if (scoreA >= tgt || scoreB >= tgt) {
        const winner = scoreA >= tgt ? "A" : "B";
        setShowWinConfirmation(winner);
        return { ...s, scoreA, scoreB };
      }
      return { ...s, scoreA, scoreB };
    });
  }

  function confirmWin(winner: "A" | "B") {
    setState((s) => finishMatch(s, winner, s.scoreA, s.scoreB));
    setShowWinConfirmation(null);
  }

  function cancelWin() {
    setShowWinConfirmation(null);
    // Decrementa 1 ponto do time que estava ganhando
    setState((s) => {
      if (showWinConfirmation === "A") {
        return { ...s, scoreA: Math.max(0, s.scoreA - 1) };
      } else if (showWinConfirmation === "B") {
        return { ...s, scoreB: Math.max(0, s.scoreB - 1) };
      }
      return s;
    });
  }

  function finishMatch(
    s: State,
    winner: "A" | "B",
    scoreA: number,
    scoreB: number,
  ): State {
    if (!s.teamA || !s.teamB) return s;

    // Salva estado atual para desfazer
    const lastState = { ...s, lastState: undefined };

    const winTeam = winner === "A" ? s.teamA : s.teamB;
    const loseTeam = winner === "A" ? s.teamB : s.teamA;
    const scoreWin = winner === "A" ? scoreA : scoreB;
    const scoreLose = winner === "A" ? scoreB : scoreA;

    // Verifica se o time perdedor era o campeão
    const championLost = s.championTeamId === loseTeam.id;
    const championWon = s.championTeamId === winTeam.id;

    let newQueue: string[];
    let newTeamA: Team | null;
    let newTeamB: Team | null;
    let newChampionId: string | null;
    let newMatchCount: number;

    if (championLost && s.currentWinStreak >= s.maxConsecutiveWins) {
      // Campeão perdeu E já jogou X partidas -> AMBOS vão para a fila
      newQueue = [...s.queue, ...loseTeam.players.map((p) => p.id), ...winTeam.players.map((p) => p.id)];

      // Monta dois novos times da fila
      const r1 = pickTeam(newQueue, byId);
      if (!r1) {
        newTeamA = null;
        newTeamB = null;
      } else {
        newTeamA = buildTeam(r1.teamIds, byId);
        const r2 = pickTeam(r1.rest, byId);
        if (!r2) {
          newTeamB = null;
          newQueue = r1.rest;
        } else {
          newTeamB = buildTeam(r2.teamIds, byId);
          newQueue = r2.rest;
        }
      }
      newChampionId = null;
      newMatchCount = 0;
    } else {
      // Fluxo normal: perdedor vai pra fila, vencedor permanece
      newQueue = [...s.queue, ...loseTeam.players.map((p) => p.id)];

      const r = pickTeam(newQueue, byId);
      const newChallenger = r ? buildTeam(r.teamIds, byId) : null;
      newQueue = r ? r.rest : newQueue;

      newTeamA = winner === "A" ? winTeam : newChallenger;
      newTeamB = winner === "B" ? winTeam : newChallenger;

      // Atualiza campeão e contador
      if (championWon) {
        // Campeão venceu novamente - incrementa contador
        newChampionId = winTeam.id;
        newMatchCount = s.currentWinStreak + 1;
      } else {
        // Novo campeão (vencedor não era o campeão anterior)
        newChampionId = winTeam.id;
        newMatchCount = 1;
      }
    }

    return {
      ...s,
      teamA: newTeamA,
      teamB: newTeamB,
      queue: newQueue,
      scoreA: 0,
      scoreB: 0,
      currentWinStreak: newMatchCount,
      championTeamId: newChampionId,
      history: [
        {
          winnerNames: winTeam.players.map((p) => p.name),
          loserNames: loseTeam.players.map((p) => p.name),
          scoreWin,
          scoreLose,
          at: Date.now(),
        },
        ...s.history,
      ].slice(0, 30),
      lastState,
    };
  }

  function declareWinner(winner: "A" | "B") {
    setState((s) => finishMatch(s, winner, s.scoreA, s.scoreB));
  }

  function undoLastMatch() {
    setState((s) => {
      if (s.lastState) {
        return s.lastState;
      }
      return s;
    });
  }

  function changeMaxWins(value: number) {
    setState((s) => ({
      ...s,
      maxConsecutiveWins: Math.max(1, Math.min(10, value)), // entre 1 e 10
    }));
  }

  function clearAll() {
    if (window.confirm("Tem certeza que deseja limpar TUDO? Isso apagará jogadores, histórico e partida atual.")) {
      console.log("Limpando tudo...");
      setState((s) => ({
        players: [],
        queue: [],
        teamA: null,
        teamB: null,
        scoreA: 0,
        scoreB: 0,
        maxConsecutiveWins: s.maxConsecutiveWins,
        currentWinStreak: 0,
        championTeamId: null,
        history: [],
      }));
    }
  }

  function resetCourt() {
    setState((s) => {
      const ids: string[] = [];
      s.teamA?.players.forEach((p) => ids.push(p.id));
      s.teamB?.players.forEach((p) => ids.push(p.id));
      return {
        ...s,
        teamA: null,
        teamB: null,
        scoreA: 0,
        scoreB: 0,
        currentWinStreak: 0,
        championTeamId: null,
        queue: [...s.queue, ...ids],
      };
    });
  }

  function resetScores() {
    setState((s) => ({ ...s, scoreA: 0, scoreB: 0 }));
  }

  function reshuffleAll() {
    setState((s) => {
      const all = [
        ...(s.teamA?.players.map((p) => p.id) ?? []),
        ...(s.teamB?.players.map((p) => p.id) ?? []),
        ...s.queue,
      ];
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }
      return {
        ...s,
        teamA: null,
        teamB: null,
        scoreA: 0,
        scoreB: 0,
        currentWinStreak: 0,
        championTeamId: null,
        queue: all,
      };
    });
  }

  const queuePlayers = state.queue.map((id) => byId[id]).filter(Boolean);
  const benchPlayers = state.players.filter(
    (p) => !state.queue.includes(p.id) && !inCourt.has(p.id),
  );

  // Calcula o próximo time da fila
  const nextTeamPreview = useMemo(() => {
    const r = pickTeam(state.queue, byId);
    return r ? r.teamIds.map((id) => byId[id]).filter(Boolean) : [];
  }, [state.queue, byId]);

  const matchOn = !!(state.teamA && state.teamB);
  const tiebreak = state.scoreA >= 11 && state.scoreB >= 11;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Vôlei dos amigos 🏐
            </h1>
            <p className="text-sm text-muted-foreground">
              Times de 4 · até 2 mulheres por time · jogo ate {target}
              {tiebreak && " (11x11 - vai a 3)"}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={undoLastMatch}
              disabled={!state.lastState}
            >
              <Undo2 className="size-4 mr-1" /> Desfazer
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={clearAll}
            >
              <TrashIcon className="size-4 mr-1" /> Limpar Tudo
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle>
                Quadra
                {matchOn && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    alvo: {target} pts
                  </span>
                )}
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                {!(state.teamA && state.teamB) && (
                  <Button size="sm" onClick={startMatch}>
                    <Shuffle className="size-4 mr-1" /> Montar times
                  </Button>
                )}
                {matchOn && (state.scoreA > 0 || state.scoreB > 0) && (
                  <Button size="sm" variant="ghost" onClick={resetScores}>
                    Zerar placar
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
                score={state.scoreA}
                target={target}
                onWin={() => declareWinner("A")}
                onInc={() => changeScore("A", +1)}
                onDec={() => changeScore("A", -1)}
                canDeclare={matchOn}
                onPlayerLeave={(id) => removePlayer(id)}
                isChampion={state.teamA?.id === state.championTeamId}
                matchCount={state.teamA?.id === state.championTeamId ? state.currentWinStreak : 0}
              />
              <TeamCard
                label="Time B"
                team={state.teamB}
                score={state.scoreB}
                target={target}
                onWin={() => declareWinner("B")}
                onInc={() => changeScore("B", +1)}
                onDec={() => changeScore("B", -1)}
                canDeclare={matchOn}
                onPlayerLeave={(id) => removePlayer(id)}
                isChampion={state.teamB?.id === state.championTeamId}
                matchCount={state.teamB?.id === state.championTeamId ? state.currentWinStreak : 0}
              />
            </CardContent>
          </Card>

          <NextTeamPreview players={nextTeamPreview} />

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
                  Ninguem na fila. Cadastre jogadores ao lado.
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

          {state.history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ultimas partidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {state.history.map((h, i) => (
                  <div
                    key={i}
                    className="text-sm flex flex-wrap items-center gap-x-2 gap-y-1 border-b last:border-0 pb-2 last:pb-0"
                  >
                    <Trophy className="size-4 text-yellow-500" />
                    <Badge variant="secondary">
                      {h.scoreWin} x {h.scoreLose}
                    </Badge>
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

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="maxWins" className="text-sm font-medium">
                  Permanência dos times
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="maxWins"
                    type="number"
                    min={1}
                    max={10}
                    value={state.maxConsecutiveWins}
                    onChange={(e) => changeMaxWins(parseInt(e.target.value) || 1)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">
                    partidas
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Time vencedor permanece até perder. Quando perder após X partidas, ambos os times são remontados
                </p>
                {state.currentWinStreak > 0 && state.championTeamId && (
                  <p className="text-xs text-muted-foreground font-medium">
                    Partidas jogadas pelo time campeão: {state.currentWinStreak}/{state.maxConsecutiveWins}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

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
                <UserPlus className="size-4 mr-1" /> Adicionar a fila
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

      {/* Confirmation Dialog */}
      <Dialog open={!!showWinConfirmation} onOpenChange={(open) => !open && cancelWin()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partida Finalizada!</DialogTitle>
            <DialogDescription>
              Time {showWinConfirmation} atingiu {target} pontos. Deseja confirmar a vitória e iniciar o próximo jogo?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={cancelWin}>
              Cancelar
            </Button>
            <Button onClick={() => showWinConfirmation && confirmWin(showWinConfirmation)}>
              Confirmar Vitória
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  score,
  target,
  onWin,
  onInc,
  onDec,
  canDeclare,
  onPlayerLeave,
  isChampion,
  matchCount,
}: {
  label: string;
  team: Team | null;
  score: number;
  target: number;
  onWin: () => void;
  onInc: () => void;
  onDec: () => void;
  canDeclare: boolean;
  onPlayerLeave: (id: string) => void;
  isChampion: boolean;
  matchCount: number;
}) {
  const matchPoint = canDeclare && score === target - 1;
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{label}</h3>
          {isChampion && matchCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              🏆 {matchCount}x
            </Badge>
          )}
        </div>
        {team && canDeclare && (
          <Button size="sm" variant="outline" onClick={onWin}>
            <Trophy className="size-4 mr-1" /> Venceu
          </Button>
        )}
      </div>

      {team && canDeclare && (
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
          <Button
            size="icon"
            variant="outline"
            onClick={onDec}
            disabled={score <= 0}
            aria-label="Diminuir ponto"
          >
            <Minus className="size-4" />
          </Button>
          <div className="text-center">
            <div className="text-4xl font-bold leading-none tabular-nums">
              {score}
            </div>
            {matchPoint && (
              <div className="text-[10px] uppercase tracking-wide text-yellow-600 dark:text-yellow-400 mt-1">
                match point
              </div>
            )}
          </div>
          <Button
            size="icon"
            onClick={onInc}
            aria-label="Adicionar ponto"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      )}

      {!team ? (
        <p className="text-sm text-muted-foreground">
          Sem time. Clique em "Montar times".
        </p>
      ) : (
        <ul className="space-y-1">
          {team.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                <GenderBadge g={p.gender} />
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-6 text-muted-foreground hover:text-destructive"
                title="Saiu / Foi embora"
                onClick={() => onPlayerLeave(p.id)}
              >
                <LogOut className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
