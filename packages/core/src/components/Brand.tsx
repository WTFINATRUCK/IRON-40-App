// The IRON 40 mark: the word set wide and heavy, with "40" struck into a round plate like a stamped part number.
export function Brand({ suffix }: { suffix?: string }) {
  return (
    <span className="brand" aria-label={`IRON 40${suffix ? ` ${suffix}` : ""}`}>
      <span className="brand-word">IRON</span>
      <span className="brand-plate" aria-hidden="true">40</span>
      {suffix && <span className="brand-suffix">{suffix}</span>}
    </span>
  );
}

export function StatusPill({ status, label }: { status: string; label: string }) {
  return <span className={`pill pill-${status}`}>{label}</span>;
}
