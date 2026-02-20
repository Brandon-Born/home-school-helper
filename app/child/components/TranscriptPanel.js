"use client";
import { TranscriptFeed } from "../../components/transcript/TranscriptFeed.js";

export function TranscriptPanel({ messages, pendingTutorReply }) {
  return (
    <TranscriptFeed
      messages={messages}
      pending={pendingTutorReply}
      emptyText="Nothing here yet — ask your first question!"
      pendingText="Thinking... ✨"
      actorLabels={{ child: "You" }}
      chatMode={true}
      enableWindowing
      windowSize={100}
      windowStep={120}
    />
  );
}
