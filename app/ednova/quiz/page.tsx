import QuizStudio from "@/components/ednova/QuizStudio";
import EdNovaGate from "@/components/ednova/EdNovaGate";

export const metadata = { title: "EdNova - Gamified Quizzes" };

export default function QuizPage() {
  return (
    <EdNovaGate>
      <QuizStudio />
    </EdNovaGate>
  );
}
