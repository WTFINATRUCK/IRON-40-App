"use client";

import { useEffect, useState } from "react";

// Entry gate required on most state cannabis sites. It's a courtesy screen, not the age check:
// the real checks are ID review before ordering and the ID scan at the door.
export function AgeGate() {
  const [open, setOpen] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!document.cookie.split("; ").includes("i40_21=1")) setOpen(true);
  }, []);

  if (!open) return null;
  return (
    <div className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className="gate-card">
        <div className="gate-plate" aria-hidden="true">21</div>
        <h2 id="gate-title">Are you 21 or older?</h2>
        {denied ? (
          <p>Sorry, you have to be 21 or older to use this site.</p>
        ) : (
          <>
            <p className="muted">You'll need a valid government ID to order and again at the door.</p>
            <div className="row">
              <button
                className="btn btn-primary"
                autoFocus
                onClick={() => {
                  document.cookie = `i40_21=1; max-age=${60 * 60 * 24 * 30}; path=/; samesite=lax; secure`;
                  setOpen(false);
                }}
              >
                Yes, I'm 21+
              </button>
              <button className="btn" onClick={() => setDenied(true)}>No</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
