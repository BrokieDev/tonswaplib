import {Address,TonClient4,Sender,toNano,WalletContractV4} from "@ton/ton";
import { mnemonicToPrivateKey,mnemonicToWalletKey } from '@ton/crypto';
import {
  Asset,
  Factory,
  JettonRoot,
  MAINNET_FACTORY_ADDR,
  Pool,
  PoolType,
  VaultNative,
} from "@dedust/sdk";
import { getTokenTradeEstimateFromDedust } from "./tonPairPriceTracker";

const tonClient = require('./tonClient');

require('dotenv').config();

/**
 * 
 * @param {string} senderMnemonic 
 * @param {object} tokenIn - An object representing input token
 * - {string} address: input token address
 * - {string} symbol : input token symbol
 * - {number} decimal : decimal places for tokenIn
 * @param {number} tokenInAmount - number of tokens to be swapped for tokenOut
 * @param {object} tokenOut  - An object representing output token
 * - {string} address: input token address
 * - {string} symbol : input token symbol
 * - {number} decimal : decimal places for tokenOut
 * @param {number} expectedTokenOutAmount: number of tokens to be exepected on swapping tokenIn, this value should be derived using this function "getTokenTradeEstimateFromDedust()"
 */
async function sendSwapRequestToDeDust(senderMnemonic,tokenIn,tokenInAmount,tokenOut,expectedTokenOutAmount){
  try{
    const tokenInAddr = Address.parse(tokenIn['address']);
    const tokenOutAddr = Address.parse(tokenOut['address']);

    const mnemonic = senderMnemonic.split(" ");

    const publicKey = (await mnemonicToWalletKey(mnemonic)).publicKey;
    const secretKey = (await mnemonicToPrivateKey(mnemonic)).secretKey;

    const sender_wallet = tonClient.open(
      WalletContractV4.create({
        workchain:0,
        publicKey
      })
    )

    const sender = sender_wallet.sender(secretKey);

    const deDustFactoryContract = tonClient.open(Factory.createFromAddress(MAINNET_FACTORY_ADDR));

    const tokenInContract = tonClient.open(JettonRoot.createFromAddress(tokenInAddr))
  
    const tokenOutContract = tonClient.open(JettonRoot.createFromAddress(tokenOutAddr));

    const poolState = tonClient.open(
      Pool.createFromAddress(
        await deDustFactoryContract.getPoolAddress({
          poolType:PoolType.VOLATILE,
          assets:[Asset.jetton(tokenInContract.address),Asset.jetton(tokenOutContract.address)]
        })
      )
    )


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

    if(poolState.account.state.type !== "active") throw new Error(" Pool does not exist");

    const amountIn = toNano(tokenInAmount);
    const expectedAmountOut = toNano(expectedTokenOutAmount);
    
    await tokenInVault.sendSwap(
      sender,
      {
        poolAddress:poolState.address,
        amount:amountIn,
        limit:expectedAmountOut,
        gasAmount:toNano("0.25")
      }
    );


  }
  catch(error){
    throw new Error(`Error while executing swap for ${tokenIn['symbol']}-${tokenOut['symbol']}`)
  }
}

module.exports = {sendSwapRequestToDeDust}