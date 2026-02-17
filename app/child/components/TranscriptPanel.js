"use client";
import { TranscriptFeed } from "../../components/transcript/TranscriptFeed.js";

export function TranscriptPanel({ messages, pendingTutorReply }) {
  return (
    <section className="card">
      <h2 className="section-title">Your conversation 💬</h2>
      <TranscriptFeed
        messages={messages}
        pending={pendingTutorReply}
        emptyText="Nothing here yet — ask your first question!"
        pendingText="Thinking... ✨"
        actorLabels={{ child: "You" }}
      />
    </section>
  );
}
