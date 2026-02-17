"use client";
import { TranscriptFeed } from "../../components/transcript/TranscriptFeed.js";

export function TranscriptPanel({ messages, pendingTutorReply }) {
  return (
    <section className="card">
      <h2 className="section-title">Transcript</h2>
      <TranscriptFeed messages={messages} pending={pendingTutorReply} actorLabels={{ child: "You" }} />
    </section>
  );
}
