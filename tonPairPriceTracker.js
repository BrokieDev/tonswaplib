const {Address,toNano} = require("@ton/ton");
const {
  Asset,
  Factory,
  JettonRoot,
  MAINNET_FACTORY_ADDR,
  Pool,
  PoolType,
  VaultNative,
} = require("@dedust/sdk");
const Decimal = require("decimal.js");
require('dotenv').config();
const tonClient = require('./tonClient')

/**
 * Calculates the price of a token in relation to another token, considering a specified slippage tolerance.
 * use full for getting token estimates for peg tokens.
 * Determines the exchange rate between two tokens
 * @param {object} tokenIn - An object representing the input token. It should contain the following properties:
 * - {string} address: input tokens contract address
 * - {string} symbol: symbol of input token 
 * - {number} decimal: the number of decimals token uses
 * @param {object} tokenOut - An object representing the input token. It should contain the following properties:
 * - {string} address: input tokens contract address
 * - {string} symbol: symbol of input token 
 * - {number} decimal: the number of decimals token uses
 * @param {number} [tokenInAmount=1] - Number of input tokens. Defaults to 1 if not provided.
 * @param {number} slippage - The slippage tolerance in percentage (e.g., 1 for 1%). Slippage represents the maximum price difference allowed for the transaction.
 * slippage is set to 0 by default to get exact price for token peg. And also be passed when swapping
 */
 const getTokenTradeEstimateFromDedust= async (tokenIn,tokenOut,tokenInAmount=1,slippage=0)=>{
  try{
  
    const tokenInAddr = Address.parse(tokenIn['address']);
    const tokenOutAddr = Address.parse(tokenOut['address']);
  
    const deDustFactoryContract = tonClient.open(Factory.createFromAddress(MAINNET_FACTORY_ADDR));
  
    const tokenInContract = tonClient.open(JettonRoot.createFromAddress(tokenInAddr))
  
    const tokenOutContract = tonClient.open(JettonRoot.createFromAddress(tokenOutAddr));
  
    const pool = tonClient.open(
      Pool.createFromAddress(
        await deDustFactoryContract.getPoolAddress({
          poolType:PoolType.VOLATILE,
          assets:[Asset.jetton(tokenInContract.address),Asset.jetton(tokenOutContract.address)]
        })
      )
    )
  
    //* NOTE: First check whether the tokens we intend to swap has vault or not.
  
    const tokenInVault = tonClient.open(
      VaultNative.createFromAddress(
        await deDustFactoryContract.getVaultAddress(Asset.jetton(tokenInContract.address))
      )
    );
  

  
    const lastBlock = await tonClient.getLastBlock();
  
    const tokenInVaultState = await tonClient.getAccountLite(
      lastBlock.last.seqno,
      tokenInVault.address
    )
  
    if(tokenInVaultState.account.state.type !== "active") throw new Error(`${tokenIn['symbol']} vault does not exist`);
  
   
  
    //* NOTE: Then we check the pair pool state.
    const poolState = await tonClient.getAccountLite(
      lastBlock.last.seqno,
      pool.address
    )
  
    if(poolState.account.state.type !== 'active') throw new Error(`pair ${tokenIn['symbol']}-${tokenOut['symbol']} pool does not exist`)
  
    let amountIn = toNano(tokenInAmount)
    let {amountOut} = await pool.getEstimatedSwapOut({
      assetIn:Asset.jetton(tokenInContract.address),
      amountIn
    })
  
    // * NOTE: variable redundancy for handling decimal precesion and provice type conversion safety
  // Convert slippage to a decimal
  slippage = new Decimal(slippage)

// Calculate the minimum amount out after applying the slippage
  let minAmountOut = new Decimal(amountOut.toString()).mul(100 - slippage).div(100);

// Use minAmountOut as the final output amount after applying the slippage
  let finalOutAmount = new Decimal(minAmountOut.toString()).div(10**tokenOut['decimal']);

  return finalOutAmount;
  
  }
  catch(error){
    throw new Error(`Error while fetching price estimates for pair ${tokenIn['address']}-${tokenOut['address']} on TON: ${error}`);  
  }
  
}

module.exports = {getTokenTradeEstimateFromDedust};