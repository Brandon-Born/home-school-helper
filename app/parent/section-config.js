export const PARENT_CONSOLE_SECTIONS = [
  {
    id: "children",
    label: "Children",
    title: "Child profiles",
    description: "Create and update child profiles, learning preferences, and subject focus."
  },
  {
    id: "sessions",
    label: "Sessions",
    title: "Session controls",
    description: "Start sessions, share join codes, and guide live tutoring."
  },
  {
    id: "managed",
    label: "Managed",
    title: "Consent and data controls",
    description: "Handle COPPA consent and privacy request workflows."
  }
];

export function resolveParentConsoleSection(sectionId) {
  return (
    PARENT_CONSOLE_SECTIONS.find((section) => section.id === sectionId) ??
    PARENT_CONSOLE_SECTIONS[0]
  );
}
