import TutorWorkspace from "@/components/ednova/TutorWorkspace";
import EdNovaGate from "@/components/ednova/EdNovaGate";

export const metadata = {
  title: "EdNova - GenAI Peer Learning Companion",
  description: "An empowering, anonymous GenAI peer-learning companion for students and study groups.",
};

export default function EdNovaPage() {
  return <EdNovaGate><TutorWorkspace /></EdNovaGate>;
}
