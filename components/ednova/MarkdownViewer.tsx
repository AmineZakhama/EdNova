"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Check, Copy } from "lucide-react";

function CodeBlock({
  inline,
  className,
  children,
  ...props
}: {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const codeString = String(children || "").replace(/\n$/, "");

  if (!inline && (match || codeString.includes("\n"))) {
    const lang = match ? match[1].toUpperCase() : "CODE";
    return (
      <div className="my-3 overflow-hidden rounded-xl border border-white/10 bg-slate-950/90 font-mono text-xs shadow-lg shadow-black/30">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3.5 py-1.5 text-[11px] text-slate-400">
          <span className="font-bold tracking-wider text-cyan-300">{lang}</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(codeString);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition cursor-pointer"
            title="Copy code snippet"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy code</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-3.5 overflow-x-auto text-slate-200 leading-relaxed font-mono">
          <code>{children}</code>
        </pre>
      </div>
    );
  }

  return (
    <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-cyan-200" {...props}>
      {children}
    </code>
  );
}

export default function MarkdownViewer({ content }: { content: string }) {
  return (
    <div className="ednova-markdown text-sm leading-7 text-slate-200">
      <ReactMarkdown
        components={{
          code: CodeBlock,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs text-slate-200">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-white/10 bg-white/5 px-3 py-2 font-semibold text-cyan-200">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-white/5 px-3 py-2 text-slate-300">{children}</td>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-cyan-400/60 pl-3 italic text-slate-400">{children}</blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
