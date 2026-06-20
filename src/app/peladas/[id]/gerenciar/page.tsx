import { notFound } from "next/navigation";
import { getChampionshipView, getPlayersWithGames } from "@/lib/queries";
import { ManageScreen } from "@/components/ManageScreen";

export const dynamic = "force-dynamic";

export default async function GerenciarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, players] = await Promise.all([
    getChampionshipView(id),
    getPlayersWithGames(),
  ]);
  if (!data) notFound();

  return (
    <ManageScreen
      data={data}
      allPlayers={players.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
