import { FPLService } from './api/index';

async function run() {
  const modes = ['safe', 'aggressive', 'value'];
  
  for (const mode of modes) {
    const data = await FPLService.getRecommendations(mode, 1000);
    console.log(`--- ${mode.toUpperCase()} MODE ---`);
    console.log(`Squad Length: ${data.squad.length}`);
    const gkpCount = data.startingXI.filter(p => p.position === 'GKP').length;
    console.log(`StartingXI Length: ${data.startingXI.length} (GKP: ${gkpCount})`);
    
    // Print the names of the starting 11 to see differences
    const names = data.startingXI.map(p => p.web_name).join(', ');
    console.log(`Starting XI: ${names}`);
    console.log('');
  }
}
run().catch(console.error);
