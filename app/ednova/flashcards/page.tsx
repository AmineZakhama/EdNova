import { redirect } from "next/navigation";

export default function FlashcardsPage() {
  redirect("/ednova/revision?openFlashcards=true");
}
