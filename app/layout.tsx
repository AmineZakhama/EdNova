import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EdNova — GenAI Peer Learning Companion",
  description: "A structured, inclusive GenAI peer-learning companion for students and collaborative study groups.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/logo.png" },
    ],
    shortcut: "/icon.svg",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-[#070b1b] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200 min-h-screen">
        {children}
      </body>
    </html>
  );
}
