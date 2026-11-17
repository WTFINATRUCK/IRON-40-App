// The wee-d-liver mark: the name set wide and heavy, with the "d" struck into a round amber plate like a stamped part.
export function Brand({ suffix }: { suffix?: string }) {
  return (
    <span className="brand" aria-label={`wee-d-liver${suffix ? ` ${suffix}` : ""}`}>
      <span className="brand-word">wee</span>
      <span className="brand-plate" aria-hidden="true">d</span>
      <span className="brand-word">liver</span>
      {suffix && <span className="brand-suffix">{suffix}</span>}
    </span>
  );
}

export function StatusPill({ status, label }: { status: string; label: string }) {
  return <span className={`pill pill-${status}`}>{label}</span>;
}
