import AnalyticsDashboard from "@/components/ednova/AnalyticsDashboard";
import EdNovaGate from "@/components/ednova/EdNovaGate";

export const metadata = {
  title: "EdNova - Learning Analytics",
  description: "Visualise your learning journey with charts and statistics.",
};

export default function AnalyticsPage() {
  return <EdNovaGate><AnalyticsDashboard /></EdNovaGate>;
}
