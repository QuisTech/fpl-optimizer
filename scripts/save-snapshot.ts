import fs from 'fs';
import path from 'path';
import { runAutoSnapshots } from './auto-snapshot.ts';

async function detectGameweek(): Promise<number> {
  const eoPath = path.resolve(process.cwd(), 'data', 'top_1000_eo.json');
  if (fs.existsSync(eoPath)) {
    try {
      const eoData = JSON.parse(fs.readFileSync(eoPath, 'utf-8'));
      if (eoData.gameweek && eoData.gameweek > 0) {
        return eoData.gameweek;
      }
    } catch {}
  }

  try {
    const res = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    const nextEvent = data.events?.find((e: any) => e.is_next) ??
                      data.events?.find((e: any) => new Date(e.deadline_time) > new Date());
    if (nextEvent?.id) return nextEvent.id;
  } catch (err: any) {
    console.warn(`[Snapshot] Could not fetch GW from FPL API: ${err.message}`);
  }

  console.error('[Snapshot] Could not detect current gameweek. Exiting.');
  process.exit(1);
}

(async () => {
  const gw = await detectGameweek();
  console.log(`[Snapshot] Archiving snapshots for GW${gw}...`);

  try {
    const snapshotDir = path.resolve(process.cwd(), 'data', 'snapshots', `gw_${gw}`);
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const filesToCopy = ['fplform.csv', 'fpl_native.csv', 'top_1000_eo.json'];
    for (const file of filesToCopy) {
      const src = path.resolve(process.cwd(), 'data', file);
      const dest = path.resolve(snapshotDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }
    console.log(`[Snapshot] File archiving completed for GW${gw}.`);
  } catch (err: any) {
    console.warn(`[Snapshot] Archive notice: ${err.message}`);
  }

  try {
    await runAutoSnapshots(gw);
  } catch (err: any) {
    console.warn(`[Snapshot] Cloud auto-snapshot notice: ${err.message}`);
  }
})();
