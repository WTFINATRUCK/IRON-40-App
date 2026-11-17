// "Add to home screen" steps for the visitor's actual device and browser.
export type Platform =
  | "ios-safari"
  | "ios-other"
  | "android-chrome"
  | "android-samsung"
  | "android-firefox"
  | "android-other"
  | "desktop"
  | "in-app";

export function detectPlatform(ua: string): Platform {
  const s = ua.toLowerCase();
  const ios = /iphone|ipad|ipod/.test(s) || (s.includes("macintosh") && s.includes("mobile"));
  const android = s.includes("android");
  // Instagram, TikTok, Facebook, Snapchat and similar in-app browsers can't install web apps.
  if (/instagram|fban|fbav|fb_iab|tiktok|bytedancewebview|snapchat|line\/|twitter|linkedinapp/.test(s)) return "in-app";
  if (ios) {
    if (/crios|fxios|edgios|opios/.test(s)) return "ios-other";
    return "ios-safari";
  }
  if (android) {
    if (s.includes("samsungbrowser")) return "android-samsung";
    if (s.includes("firefox")) return "android-firefox";
    if (s.includes("chrome")) return "android-chrome";
    return "android-other";
  }
  return "desktop";
}

export const installSteps: Record<Platform, { title: string; steps: string[] }> = {
  "ios-safari": {
    title: "iPhone or iPad (Safari)",
    steps: [
      "Tap the Share button at the bottom of the screen (the square with an arrow pointing up).",
      "Scroll down and tap Add to Home Screen.",
      "Tap Add in the top-right corner.",
      "Open the app from your home screen from now on.",
    ],
  },
  "ios-other": {
    title: "iPhone or iPad (Chrome, Firefox or Edge)",
    steps: [
      "Tap the Share button next to the address bar.",
      "Tap Add to Home Screen. If you don't see it, tap Edit Actions and add it.",
      "Tap Add.",
      "On older iOS versions, open this page in Safari instead and add it from there.",
    ],
  },
  "android-chrome": {
    title: "Android (Chrome)",
    steps: [
      "Tap Install app below, or tap the ⋮ menu in the top-right corner.",
      "Choose Install app (or Add to Home screen).",
      "Tap Install to confirm.",
    ],
  },
  "android-samsung": {
    title: "Samsung Internet",
    steps: [
      "Tap the menu button (three lines) at the bottom right.",
      "Tap Add page to, then Home screen.",
      "Tap Add.",
    ],
  },
  "android-firefox": {
    title: "Android (Firefox)",
    steps: ["Tap the ⋮ menu.", "Tap Install (or Add to Home screen).", "Tap Add."],
  },
  "android-other": {
    title: "Android",
    steps: [
      "Open your browser's menu.",
      "Look for Install app or Add to Home screen.",
      "If neither is there, open this page in Chrome and try again.",
    ],
  },
  desktop: {
    title: "Computer",
    steps: [
      "In Chrome or Edge, click the install icon at the right end of the address bar.",
      "Or scan the code on our flyer with your phone to install it there.",
    ],
  },
  "in-app": {
    title: "You're inside another app's browser",
    steps: [
      "This browser can't add apps to your home screen.",
      "Tap the ⋯ or share menu and choose Open in browser (Safari on iPhone, Chrome on Android).",
      "Then follow the steps that appear.",
    ],
  },
};
