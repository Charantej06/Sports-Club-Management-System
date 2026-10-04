"use client";

import { money } from "@/lib/utils";

const names: Record<string, string> = {
  MEMBERSHIP: "Memberships", COURT: "Courts", SHOP: "Club shop",
  CLUBHOUSE: "Clubhouse", CASH: "Cash", CARD: "Card", UPI: "UPI",
  LOCAL: "Local test", GATEWAY: "Online gateway",
};
const colors = ["#315b83", "#52867b", "#b47a28", "#78859b", "#a56d82"];

type Department = { department: string; salesPaise: number; collectionsPaise: number };
type Method = { method: string; amountPaise: number };

export function ReportCharts({ departments, methods, collectionsPaise, onDepartment, onMethod }: {
  departments: Department[];
  methods: Method[];
  collectionsPaise: number;
  onDepartment: (department: string) => void;
  onMethod: (method: string) => void;
}) {
  const maximum = Math.max(1, ...departments.flatMap((d) => [d.salesPaise, d.collectionsPaise]));
  let offset = 0;
  return (
    <div className="report-charts">
      <section className="surface report-chart" aria-labelledby="department-chart-title">
        <h3 id="department-chart-title">Where the club earns</h3>
        <p className="report-chart-description">Invoiced sales and allocated collections for the selected dates.</p>
        <div className="report-chart-key" aria-hidden="true">
          <span><i className="report-swatch-sales" />Invoiced sales</span>
          <span><i className="report-swatch-collections" />Collections</span>
        </div>
        {!departments.some((d) => d.salesPaise || d.collectionsPaise) && (
          <p className="report-chart-empty">No department sales or collections in this date range.</p>
        )}
        <div className="report-departments">
          {departments.map((d) => (
            <button key={d.department} className="report-department" onClick={() => onDepartment(d.department)}
              aria-label={`${names[d.department] || d.department}: invoiced sales ${money(d.salesPaise)}, allocated collections ${money(d.collectionsPaise)}. View sales records.`}>
              <span className="report-department-name">{names[d.department] || d.department}</span>
              <span className="report-bar-row">
                <span className="report-bar-track" aria-hidden="true"><span className="report-bar-sales" style={{ width: `${d.salesPaise / maximum * 100}%` }} /></span>
                <span className="report-bar-value"><span className="sr-only">Invoiced sales: </span>{money(d.salesPaise)}</span>
              </span>
              <span className="report-bar-row">
                <span className="report-bar-track" aria-hidden="true"><span className="report-bar-collections" style={{ width: `${d.collectionsPaise / maximum * 100}%` }} /></span>
                <span className="report-bar-value"><span className="sr-only">Collections: </span>{money(d.collectionsPaise)}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="report-chart-footnote">Select a department to see its sales records. Collections can settle earlier invoices.</p>
      </section>
      <section className="surface report-chart" aria-labelledby="method-chart-title">
        <h3 id="method-chart-title">How payments came in</h3>
        <p className="report-chart-description">All received collections, including unallocated payments.</p>
        <div className="report-payment-ring" aria-hidden="true">
          <svg viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="78" fill="none" stroke="#e9eef3" strokeWidth="22" />
            {collectionsPaise > 0 && methods.map((m, i) => {
              const share = m.amountPaise / collectionsPaise * 100;
              const start = offset;
              offset += share;
              return <circle key={m.method} cx="100" cy="100" r="78" fill="none" stroke={colors[i % colors.length]}
                strokeWidth="22" pathLength="100" strokeDasharray={`${share} ${100 - share}`}
                strokeDashoffset={-start} transform="rotate(-90 100 100)" />;
            })}
          </svg>
          <div><span>Total collections</span><strong>{money(collectionsPaise)}</strong></div>
        </div>
        {collectionsPaise === 0 && <p className="report-chart-empty">No payments received in this date range.</p>}
        <div className="report-methods">
          {methods.map((m, i) => (
            <button key={m.method} onClick={() => onMethod(m.method)} className="report-method"
              aria-label={`${names[m.method] || m.method}: ${money(m.amountPaise)}. View payment records.`}>
              <i style={{ background: colors[i % colors.length] }} aria-hidden="true" />
              <span>{names[m.method] || m.method}</span>
              <strong>{money(m.amountPaise)}</strong>
              <small>{collectionsPaise > 0 ? Math.round(m.amountPaise / collectionsPaise * 100) : 0}%</small>
            </button>
          ))}
        </div>
        <p className="report-chart-footnote">Select a method to see payment records. Local test payments are simulated.</p>
      </section>
    </div>
  );
}
