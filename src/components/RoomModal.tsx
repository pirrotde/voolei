import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, LogIn } from "lucide-react";

interface RoomModalProps {
  onCreateRoom: (name: string) => Promise<void>;
  onJoinRoom: (code: string) => Promise<void>;
}

export function RoomModal({ onCreateRoom, onJoinRoom }: RoomModalProps) {
  const [roomName, setRoomName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    const name = roomName.trim();
    if (!name) {
      setError("Digite um nome para a sala");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onCreateRoom(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar sala");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError("Digite o código da sala");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onJoinRoom(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar na sala");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Vôlei dos amigos 🏐</CardTitle>
          <CardDescription>
            Crie uma nova sala ou entre em uma existente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="join">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="join">Entrar</TabsTrigger>
              <TabsTrigger value="create">Criar</TabsTrigger>
            </TabsList>

            <TabsContent value="join" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Código da Sala</label>
                <Input
                  placeholder="Ex: ABC123"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  disabled={loading}
                  maxLength={10}
                />
              </div>
              <Button onClick={handleJoin} className="w-full" disabled={loading}>
                <LogIn className="size-4 mr-2" />
                {loading ? "Entrando..." : "Entrar na Sala"}
              </Button>
            </TabsContent>

            <TabsContent value="create" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome da Sala</label>
                <Input
                  placeholder="Ex: Vôlei da Quinta"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  disabled={loading}
                />
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={loading}>
                <Users className="size-4 mr-2" />
                {loading ? "Criando..." : "Criar Sala"}
              </Button>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="mt-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
