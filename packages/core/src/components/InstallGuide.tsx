"use client";

import { useEffect, useState } from "react";
import { detectPlatform, installSteps, type Platform } from "../install";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallGuide({ appName, initialPlatform }: { appName: string; initialPlatform: Platform }) {
  const [platform, setPlatform] = useState<Platform>(initialPlatform);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent));
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <div className="install">
        <h2>{appName} is on your home screen</h2>
        <p>Open it from there for the fastest checkout.</p>
      </div>
    );
  }

  const guide = installSteps[platform];
  const others = (Object.keys(installSteps) as Platform[]).filter((p) => p !== platform && p !== "in-app");

  return (
    <div className="install">
      <h2>Add {appName} to your home screen</h2>
      <p className="muted">Detected: {guide.title}</p>
      {prompt && (
        <button
          className="btn btn-primary"
          onClick={async () => {
            await prompt.prompt();
            await prompt.userChoice;
            setPrompt(null);
          }}
        >
          Install app
        </button>
      )}
      <ol className="steps">
        {guide.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <details>
        <summary>Using a different phone?</summary>
        {others.map((p) => (
          <div key={p} className="other-guide">
            <h3>{installSteps[p].title}</h3>
            <ol className="steps">
              {installSteps[p].steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        ))}
      </details>
    </div>
  );
}
