import { chromium, type Browser } from 'playwright';
import { existsSync } from 'node:fs';
export async function launchBrowser(): Promise<Browser> {
  const explicit = process.env.STUDY_SHEET_CHROME;
  if (explicit && !existsSync(explicit)) throw new Error(`STUDY_SHEET_CHROME 不存在：${explicit}`);
  const candidates = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const executablePath = explicit || candidates.find(p => existsSync(p));
  return chromium.launch({ headless: true, executablePath });
}
