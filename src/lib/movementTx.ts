/**
 * Movement Network Transaction Helpers
 * 
 * This file contains helpers for building and sending transactions
 * to Movement Network using Petra wallet via Aptos wallet adapter.
 */

import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { getCurrentNetworkConfig, getModuleAddress, moveToOctas, convertToMovementAddress } from './movement';
import { TipPayloadParams, TipEvent } from '@/types/tip';
import { CreatePostParams } from '@/types/post';
import { getGasEstimation } from './movementClient';

// Helper to get dynamic client based on current network
function getAptosClient() {
    const currentConfig = getCurrentNetworkConfig();
    const config = new AptosConfig({
        network: Network.CUSTOM,
        fullnode: currentConfig.rpcUrl,
    });
    return new Aptos(config);
}

/**
 * Build transaction payload for tipping
 * 
 * Uses the deployed TipJar contract on Movement Network.
 * The contract provides a simple wrapper around coin transfer.
 * 
 * @param params - Tip parameters
 * @param gasEstimation - Optional gas estimation, will fetch if not provided
 */
export async function buildTipPostPayload(
    params: TipPayloadParams,
    gasEstimation?: { maxGasAmount: number; gasUnitPrice: number }
): Promise<any> {
    const TIPJAR_MODULE_ADDRESS = getModuleAddress();
    if (!TIPJAR_MODULE_ADDRESS || TIPJAR_MODULE_ADDRESS.length < 10) {
        throw new Error("Tipping is not enabled on this network (Module address not configured).");
    }

    const { creatorAddress, amount, postId } = params;

    // Ensure address is in 32-byte format (Movement requirement)
    const formattedCreatorAddress = convertToMovementAddress(creatorAddress);

    // Convert amount to octas (8 decimals)
    const amountInOctas = moveToOctas(amount);

    console.log(`🔢 Converting amount: ${amount} MOVE -> ${amountInOctas} octas`);

    const payload: any = {
        data: {
            function: `${TIPJAR_MODULE_ADDRESS}::move_feed_v12::tip_post`,
            typeArguments: [],
            functionArguments: [
                formattedCreatorAddress,
                postId.toString(),
                amountInOctas.toString(),
            ],
        }
    };

    // Only add gas options if explicitly provided and valid
    if (gasEstimation) {
        console.log('⛽ Using provided gas config:', gasEstimation);
        payload.options = {
            maxGasAmount: gasEstimation.maxGasAmount,
            gasUnitPrice: gasEstimation.gasUnitPrice,
        };
    }

    return payload;
}

/**
 * Send tip to a post using Petra wallet
 * 
 * @param params - Tip parameters
 * @param signAndSubmitTransaction - Function from useWallet() hook
 * @returns Transaction hash
 */
export async function sendTipToPost(
    params: TipPayloadParams,
    signAndSubmitTransaction: any
): Promise<string> {
    try {
        // We do NOT manually set gas options for the wallet adapter.
        // We let the wallet (Petra) handle gas estimation and simulation.
        // Manually setting gas often causes "silent rejections" or simulation failures
        // if the parameters are slightly off from what the node expects.
        
        const payload = await buildTipPostPayload(params); // No gas estimation passed

        console.log('🔨 Building tip transaction (letting wallet handle gas):', payload);

        // Sign and submit transaction using Petra
        const response = await signAndSubmitTransaction(payload);

        console.log('✅ Transaction submitted:', response.hash);

        // Wait for transaction confirmation
        const client = getAptosClient();
        await client.waitForTransaction({
            transactionHash: response.hash,
        });

        console.log('🎉 Transaction confirmed!');

        return response.hash;
    } catch (error: any) {
        console.error('❌ Failed to send tip:', error);

        // Check for specific network error related to movementinfra.xyz or DNS
        if (error?.message?.includes('Failed to fetch') || error?.toString().includes('Failed to fetch')) {
             if (typeof window !== 'undefined') {
                 alert(`Network Error: It seems your wallet is trying to connect to an old or invalid node URL.\n\nPlease check your Wallet Settings -> Network -> Movement Mainnet.\n\nEnsure RPC URL is: https://mainnet.movementnetwork.xyz/v1\n(NOT movementinfra.xyz)`);
             }
        }

        throw error;
    }
}

/**
 * Build transaction payload for creating a post
 * 
 * Note: This function may not work if create_post is not in the deployed module
 * 
 * @param params - Post creation parameters
 * @param gasEstimation - Optional gas estimation, will fetch if not provided
 */
export async function buildCreatePostPayload(
    params: CreatePostParams,
    gasEstimation?: { maxGasAmount: number; gasUnitPrice: number }
): Promise<any> {
    const { content, style } = params;
    const TIPJAR_MODULE_ADDRESS = getModuleAddress();

    if (!TIPJAR_MODULE_ADDRESS) {
        throw new Error("Module address not configured.");
    }

    // Map style to number (0 = minimal, 1 = gradient, 2 = bold)
    // const styleMap = { minimal: 0, gradient: 1, bold: 2 };
    // const styleValue = styleMap[style];

    // Get gas estimation if not provided
    let gasConfig = gasEstimation;
    if (!gasConfig) {
        const estimation = await getGasEstimation();
        gasConfig = {
            maxGasAmount: estimation.maxGasAmount,
            gasUnitPrice: estimation.gasUnitPrice,
        };
    }

    return {
        data: {
            function: `${TIPJAR_MODULE_ADDRESS}::move_feed_v12::create_post`,
            typeArguments: [],
            functionArguments: [
                content, // Pass string directly, SDK handles it
                style,   // Pass style as image_url
            ],
        },
        options: {
            maxGasAmount: gasConfig.maxGasAmount,
            gasUnitPrice: gasConfig.gasUnitPrice,
        },
    };
}

/**
 * Create a post using Petra wallet
 */
export async function createPost(
    params: CreatePostParams,
    signAndSubmitTransaction: any
): Promise<string> {
    try {
        // Get gas estimation before building payload
        const gasEstimation = await getGasEstimation();
        console.log('⛽ Gas estimation:', gasEstimation);

        const payload = await buildCreatePostPayload(params, {
            maxGasAmount: gasEstimation.maxGasAmount,
            gasUnitPrice: gasEstimation.gasUnitPrice,
        });

        console.log('🔨 Creating post:', payload);

        const response = await signAndSubmitTransaction(payload);

        console.log('✅ Post created:', response.hash);

        const client = getAptosClient();
        await client.waitForTransaction({
            transactionHash: response.hash,
        });

        return response.hash;
    } catch (error) {
        console.error('❌ Failed to create post:', error);
        throw error;
    }
}

/**
 * Fetch tip history for a creator
 * 
 * TODO: Implement real event querying from Movement Network
 * For now, returns mock data with correct structure
 */
export async function fetchTipHistory(creatorAddress: string): Promise<TipEvent[]> {
    console.log('📊 Fetching tip history for:', creatorAddress);

    // TODO: Query Move events from Movement Network
    // For now, return mock data
    const mockHistory: TipEvent[] = [
        {
            sender: '0x1234...5678',
            receiver: creatorAddress,
            postId: '1',
            amount: 0.5,
            timestamp: Date.now() - 3600000,
            txHash: '0xabc...def',
        },
        {
            sender: '0x8765...4321',
            receiver: creatorAddress,
            postId: '2',
            amount: 1.0,
            timestamp: Date.now() - 7200000,
            txHash: '0x123...456',
        },
    ];

    return mockHistory;
}

/**
 * Get total tips for a specific post
 * 
 * TODO: Query from on-chain state
 */
export async function getTipAmountForPost(postId: string): Promise<number> {
    console.log('📊 Fetching tips for post:', postId);

    // TODO: Query from Move module state
    // For now, return mock data
    return Math.random() * 5;
}
