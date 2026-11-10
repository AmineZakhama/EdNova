import GroupRoom from "@/components/ednova/GroupRoom";
import EdNovaGate from "@/components/ednova/EdNovaGate";

export const metadata = {
  title: "EdNova - Group Learning Room",
  description: "Peer discussion room with AI facilitation.",
};

export default function GroupPage() {
  return <EdNovaGate><GroupRoom /></EdNovaGate>;
}
