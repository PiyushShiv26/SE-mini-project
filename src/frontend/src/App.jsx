const plannedFeatures = [
  'Publish a ride with pickup, destination, time, and available seats',
  'Search and match rides by route and timing',
  'Request seats and manage booking status',
  'Coordinate with ride participants',
  'View ride history and submit ratings',
]

export default function App() {
  return (
    <main className="page">
      <header className="topbar">
        <span className="brand-mark" aria-hidden="true">CR</span>
        <span>Campus Ride-Share</span>
        <span className="status">Starter</span>
      </header>

      <section className="hero">
        <p className="eyebrow">PES UNIVERSITY · SE MINI-PROJECT · TEAM 12</p>
        <h1>Your campus commute,<br /><span>connected.</span></h1>
        <p className="intro">
          A shared platform for students offering rides and students looking
          for one. Find compatible routes, coordinate timings, and make better
          use of available seats.
        </p>
        <div className="actions">
          <button type="button" disabled>Find a ride · Coming soon</button>
          <button type="button" className="secondary" disabled>Offer a ride · Coming soon</button>
        </div>
      </section>

      <section className="features" aria-labelledby="features-heading">
        <div className="section-heading">
          <p className="eyebrow">THE PLAN</p>
          <h2 id="features-heading">Built around your journey</h2>
        </div>
        <div className="feature-grid">
          {plannedFeatures.map((feature, index) => (
            <article className="feature-card" key={feature}>
              <span className="feature-number">0{index + 1}</span>
              <p>{feature}</p>
            </article>
          ))}
        </div>
      </section>

      <footer>Team 12 · Campus Ride-Share Matching System</footer>
    </main>
  )
}
