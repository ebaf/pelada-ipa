import { getPlayerRanking } from "@/lib/queries";
import { PlayersScreen } from "@/components/PlayersScreen";

export const dynamic = "force-dynamic";

export default async function JogadoresPage() {
  const players = await getPlayerRanking();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">Jogadores</h1>
      <PlayersScreen players={players} />
    </div>
  );
}
