import {
  adminDashboardLayoutChecks,
  adminDashboardPanels,
  adminDashboardWidthNotes,
} from "../fixtures/demoData";
import { ADMIN_DASHBOARD_MIN_SUPPORTED_WIDTH } from "../layout";
import { CampaignMessageAssignmentPanel } from "./CampaignMessageAssignmentPanel";
import "./DemoAdminDashboard.css";

const statusLabels = {
  ready: "Ready",
  "needs-review": "Needs review",
  draft: "Draft",
};

export function DemoAdminDashboard() {
  return (
    <section className="demo-admin-dashboard" aria-labelledby="demo-admin-dashboard-title">
      <header className="demo-admin-dashboard__hero">
        <div>
          <p className="demo-admin-dashboard__eyebrow">Demo Admin Dashboard</p>
          <h1 id="demo-admin-dashboard-title">Populate safe demo UI data</h1>
          <p>
            A responsive maintainer workspace for preparing deterministic demo data at tablet,
            laptop, and desktop widths while staying isolated from production mail flows.
          </p>
        </div>
        <aside className="demo-admin-dashboard__support-note" aria-label="Supported width note">
          <strong>{ADMIN_DASHBOARD_MIN_SUPPORTED_WIDTH}px+</strong>
          <span>Supported review width for this focused dashboard slice.</span>
        </aside>
      </header>

      <div className="demo-admin-dashboard__shell">
        <nav className="demo-admin-dashboard__controls" aria-label="Demo data controls">
          <button type="button">Preview fixture set</button>
          <button type="button">Validate layout checks</button>
          <button type="button">Export review notes</button>
        </nav>

        <div className="demo-admin-dashboard__content">
          <section className="demo-admin-dashboard__cards" aria-label="Demo data areas">
            {adminDashboardPanels.map((panel) => (
              <article className="demo-admin-dashboard__card" key={panel.id}>
                <div className="demo-admin-dashboard__card-header">
                  <h2>{panel.title}</h2>
                  <span data-status={panel.status}>{statusLabels[panel.status]}</span>
                </div>
                <p>{panel.description}</p>
                <strong>{panel.demoRecords} fake records</strong>
              </article>
            ))}
          </section>

          <aside className="demo-admin-dashboard__review" aria-label="Responsive review notes">
            <h2>Width notes</h2>
            <ul>
              {adminDashboardWidthNotes.map((note) => (
                <li key={note.breakpoint}>
                  <strong>{note.breakpoint}</strong>
                  <span>
                    {note.columns} column layout · {note.sidebarMode} controls
                  </span>
                  <p>{note.note}</p>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <section className="demo-admin-dashboard__checks" aria-label="Layout checks">
          {adminDashboardLayoutChecks.map((check) => (
            <article key={check.id}>
              <span>{check.breakpoint}</span>
              <h3>{check.label}</h3>
              <p>{check.expected}</p>
            </article>
          ))}
        </section>
      </div>

      <CampaignMessageAssignmentPanel />
    </section>
  );
}
