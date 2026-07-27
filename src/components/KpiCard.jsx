export function KpiCard({ label, value, subtext, tone = "" }) {
  return (
    <section className="kpi-card">
      <div className="label">{label}</div>
      <div className={`kpi-value ${tone}`}>{value}</div>
      <div className="subtext">{subtext}</div>
    </section>
  );
}
