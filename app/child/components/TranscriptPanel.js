"use client";
import { TranscriptFeed } from "../../components/transcript/TranscriptFeed.js";

export function TranscriptPanel({ messages, pendingTutorReply }) {
  return (
    <section className="card">
      <h2 className="section-title">Lesson Conversation</h2>
      <TranscriptFeed
        messages={messages}
        pending={pendingTutorReply}
        emptyText="Your lesson messages will show up here."
        actorLabels={{ child: "You" }}
      />
    </section>
  );
}
