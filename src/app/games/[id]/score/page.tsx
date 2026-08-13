import { ScoreScreen } from "@/components/ScoreScreen";

export default async function ScorePage({ params }: PageProps<"/games/[id]/score">) {
  const { id } = await params;
  return <ScoreScreen gameId={id} />;
}
