export const PARENT_CONSOLE_SECTIONS = [
  {
    id: "children",
    label: "Children",
    title: "Child profiles",
    description: "Set up your kids, manage their learning levels, and pick what they focus on."
  },
  {
    id: "sessions",
    label: "Sessions",
    title: "Session controls",
    description: "Start a new session, send join codes to your kids, and follow along live."
  },
  {
    id: "managed",
    label: "Privacy & Data",
    title: "Consent and data controls",
    description: "Manage your family's privacy settings, review saved data, and control account permissions."
  }
];

export function resolveParentConsoleSection(sectionId) {
  return (
    PARENT_CONSOLE_SECTIONS.find((section) => section.id === sectionId) ??
    PARENT_CONSOLE_SECTIONS[0]
  );
}
