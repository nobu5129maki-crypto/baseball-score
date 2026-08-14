import { LineupScreen } from "@/components/LineupScreen";

export default async function LineupPage({ params }: PageProps<"/games/[id]/lineup">) {
  const { id } = await params;
  return <LineupScreen gameId={id} />;
}
