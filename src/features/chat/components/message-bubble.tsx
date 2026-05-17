import type { ChatMessage } from "@/lib/chat/types";
import { formatTime } from "@/lib/utils/time";

/** A single chat message, aligned right when sent by the current user. */
export function MessageBubble({
  message,
  own,
}: {
  message: ChatMessage;
  own: boolean;
}) {
  return (
    <div className={`flex gap-2.5 ${own ? "flex-row-reverse" : "flex-row"}`}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          own ? "bg-glow/25 text-glow" : "bg-surface-elevated text-muted"
        }`}
      >
        {message.authorInitials}
      </span>

      <div className={`max-w-[78%] ${own ? "items-end" : "items-start"} flex flex-col`}>
        {!own && (
          <span className="mb-0.5 text-xs font-medium text-muted">
            {message.authorName}
          </span>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm ${
            own
              ? "rounded-tr-sm bg-glow text-white"
              : "rounded-tl-sm bg-surface text-foreground"
          }`}
        >
          {message.body}
        </div>
        <span className="mt-0.5 text-[10px] text-muted">
          {formatTime(message.sentAt)}
        </span>
      </div>
    </div>
  );
}
