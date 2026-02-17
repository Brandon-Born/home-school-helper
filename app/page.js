export default function HomePage() {
  return (
    <main style={{ padding: 24, maxWidth: 760 }}>
      <h1>Homeschool Tutor v1</h1>
      <p>Server routes are ready for child tutoring turns and parent nudges.</p>
      <ul>
        <li>POST /api/session/:id/child-turn</li>
        <li>POST /api/session/:id/parent-nudge</li>
      </ul>
    </main>
  );
}
