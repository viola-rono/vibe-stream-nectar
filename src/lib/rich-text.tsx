import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

// Splits text into plain, @mentions, #hashtags and URLs, rendered as links.
export function RichText({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const parts: ReactNode[] = [];
  const re = /(@[a-zA-Z0-9_]+|#[a-zA-Z0-9_]+|https?:\/\/[^\s]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("@")) {
      const uname = tok.slice(1);
      parts.push(
        <Link key={key++} to="/u/$username" params={{ username: uname }} className="text-primary font-medium hover:underline">
          {tok}
        </Link>,
      );
    } else if (tok.startsWith("#")) {
      const tag = tok.slice(1);
      parts.push(
        <Link key={key++} to="/t/$tag" params={{ tag }} className="text-primary font-medium hover:underline">
          {tok}
        </Link>,
      );
    } else {
      parts.push(
        <a key={key++} href={tok} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">
          {tok}
        </a>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className={className}>{parts}</span>;
}