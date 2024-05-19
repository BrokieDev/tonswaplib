const {TonClient4} = require('@ton/ton');
require('dotenv').config();

let tonClient;
try {
  tonClient = new TonClient4({
    endpoint: process.env.TON_RPC_URL,
  });
} catch (error) {
  console.error("Failed to initialize tonClient:", error);
  process.exit(1); 
}

module.exports = tonClient; 
