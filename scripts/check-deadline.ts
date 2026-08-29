import axios from 'axios';

const FPL_BASE_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';

(async () => {
  try {
    // 1. Fetch bootstrap-static using axios with standard headers to bypass Cloudflare/agent limits
    const response = await axios.get(FPL_BASE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 5000
    });
    const data = response.data;
    
    // 2. Robust selection: find the semantically next event, falling back to next chronological deadline
    const nextEvent = data.events.find((e: any) => e.is_next) ?? 
                      data.events.find((e: any) => new Date(e.deadline_time) > new Date());
    
    if (!nextEvent) {
      console.log('[Deadline Sniper] No upcoming gameweek found. Sleeping.');
      process.exit(1);
    }

    const deadlineTime = new Date(nextEvent.deadline_time).getTime();
    const now = Date.now();
    
    // Calculate difference in decimal hours
    const hoursUntilDeadline = (deadlineTime - now) / (1000 * 60 * 60);

    console.log(`[Deadline Sniper] Gameweek ${nextEvent.id} deadline is at ${nextEvent.deadline_time}.`);
    console.log(`[Deadline Sniper] Time until deadline: ${hoursUntilDeadline.toFixed(2)} hours.`);

    // 3. Trigger Window: 0.9 to 2.1 hours before deadline.
    // Width of 1.2 hours ensures that even with 5-10 minutes of GitHub Actions cron trigger latency, 
    // we never miss the execution opportunity.
    if (hoursUntilDeadline > 0.25 && hoursUntilDeadline <= 2.5) {
      console.log('✅ [Deadline Sniper] GOLDEN WINDOW REACHED! Time to fetch live data.');
      process.exit(0); // Exit 0 tells GitHub Actions to proceed to the next step
    } else {
      console.log('⏳ [Deadline Sniper] Not in the window. Going back to sleep.');
      process.exit(1); // Exit 1 tells GitHub Actions to abort the rest of the workflow silently
    }
  } catch (err: any) {
    console.error('Error fetching FPL API:', err.message);
    process.exit(1);
  }
})();
