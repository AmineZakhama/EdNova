import RevisionStudio from "@/components/ednova/RevisionStudio";
import EdNovaGate from "@/components/ednova/EdNovaGate";

export const metadata = { title: "EdNova - Revision notes & Flashcards" };

export default function RevisionPage() {
  return (
    <EdNovaGate>
      <RevisionStudio />
    </EdNovaGate>
  );
}
