/**
 * MicroThreads Client
 * 
 * Client functions for interacting with the MoveX smart contract
 */

import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { getCurrentNetworkConfig, getModuleAddress, convertToMovementAddress, isValidMovementAddress } from "./movement";
import { getGasEstimation } from "./movementClient"; // Keep for future use or remove if strict

export interface OnChainPost {
    id: number;
    global_id?: number;
    creator: string;
    content: string;
    image_url?: string;
    style: number;
    total_tips: number;
    timestamp: number;
    is_deleted: boolean;
    updated_at: number;
    last_tip_timestamp: number;
    parent_id: number;
    is_comment: boolean;
}

// Helper to get dynamic client based on current network
// Suppress SDK console warnings about CUSTOM network
function getClient() {
    const currentConfig = getCurrentNetworkConfig();
    
    // Temporarily suppress console.log to hide SDK warnings
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalInfo = console.info;
    
    const suppressSDKWarnings = (...args: any[]) => {
        const message = args[0]?.toString?.() || '';
        if (message.includes('CUSTOM network') || message.includes('lookup ChainId')) {
            return false; // Suppress this message
        }
        return true; // Allow this message
    };
    
    console.log = (...args: any[]) => {
        if (suppressSDKWarnings(...args)) {
            originalLog.apply(console, args);
        }
    };
    console.warn = (...args: any[]) => {
        if (suppressSDKWarnings(...args)) {
            originalWarn.apply(console, args);
        }
    };
    console.info = (...args: any[]) => {
        if (suppressSDKWarnings(...args)) {
            originalInfo.apply(console, args);
        }
    };
    
    const config = new AptosConfig({
        network: Network.CUSTOM,
        fullnode: currentConfig.rpcUrl,
    });
    
    const client = new Aptos(config);
    
    // Restore console functions after a short delay
    setTimeout(() => {
        console.log = originalLog;
        console.warn = originalWarn;
        console.info = originalInfo;
    }, 100);
    
    return client;
}

const MODULE_NAME = "move_feed_v13";

// Profile cache to avoid repeated 404 requests
const profileCache = new Map<string, { name?: string; avatar?: string; profile?: any; timestamp: number }>();
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper to safely extract string from Move String or raw string
const getString = (val: any): string => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object' && val.vec) {
        // Handle hex encoded strings if necessary, but usually it's just the string
        // If it's a byte array, we might need to decode it, but standard String is usually utf8
        return val.vec[0] || "";
    }
    return "";
};

// Helper to check for 404 / Not Found errors from Aptos SDK or Proxy
const isNotFound = (error: any): boolean => {
    if (!error) return false;
    return (
        error.status === 404 || 
        error.message?.includes("resource_not_found") || 
        error.error_code === "resource_not_found" ||
        error.message?.includes("Not Found") || // Generic 404 message
        (error.message?.includes("module_not_found"))
    );
};

/**
 * Initialize the global posts registry (Admin only)
 */
export async function initializeGlobalFeed(
    signAndSubmitTransaction: (transaction: InputTransactionData) => Promise<any>
): Promise<boolean> {
    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) {
        console.error("Mainnet contract address not configured. Please deploy the contract and update src/lib/movement.ts");
        return false;
    }

    const transaction: InputTransactionData = {
        data: {
            function: `${MODULE_ADDRESS}::${MODULE_NAME}::initialize`,
            functionArguments: [],
        },
    };

    try {
        const response = await signAndSubmitTransaction(transaction);
        const client = getClient();
        await client.waitForTransaction({ transactionHash: response.hash });
        return true;
    } catch (error) {
        console.error("Error initializing global feed:", error);
        return false;
    }
}

/**
 * Create a new post on-chain
 */
export async function createPostOnChain(
    content: string,
    imageUrl: string,
    style: number,
    signAndSubmitTransaction: (transaction: InputTransactionData) => Promise<any>,
    userAddress?: string // Optional: user address to check account existence
): Promise<number | null> {
    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) throw new Error("Mainnet contract address not configured. Please deploy the contract and update src/lib/movement.ts");

    // Check if signAndSubmitTransaction is available (wallet is connected)
    if (!signAndSubmitTransaction) {
        throw new Error("Wallet is not connected. Please connect your wallet first.");
    }

    // Optional: Check if account exists before attempting transaction
    // This helps provide better error messages, but we don't fail if check fails
    if (userAddress) {
        try {
            const client = getClient();
            await client.getAccountInfo({ accountAddress: userAddress });
        } catch (e: any) {
            // If account doesn't exist, we'll let the transaction fail with a clearer error
            // Don't throw here - let the transaction attempt proceed
            // The error will be caught and handled below
        }
    }

    // Explicitly define type arguments as empty for non-generic entry functions
    // This helps some wallets avoid misinterpretation
    // IMPORTANT: No gas options here - let wallet handle gas estimation automatically
    // This prevents wallets from misinterpreting the transaction as a coin transfer
    const transaction: InputTransactionData = {
        data: {
            function: `${MODULE_ADDRESS}::${MODULE_NAME}::create_post`,
            typeArguments: [],
            functionArguments: [content, imageUrl],
        },
        // Explicitly do NOT include options to avoid wallet misinterpretation
    };

    try {
        // Optional: Simulate to verify before prompting wallet
        // This helps debug if the wallet UI is showing weird things due to failure
        try {
            const client = getClient();
            // We can't simulate easily without the sender's public key or account object
            // which useWallet doesn't expose directly for simulation without prompt.
            // But we can assume if the payload is standard, it should work.
            // Removed console.log for production - use browser devtools if needed
        } catch (e) {
            // Simulation check skipped - this is normal and expected
        }

        const response = await signAndSubmitTransaction(transaction);
        const client = getClient();
        const result = await client.waitForTransaction({ transactionHash: response.hash }) as any;

        // Dispatch event for UI refresh
        window.dispatchEvent(new Event('tip_sent'));

        // Try to find post_id in events
        if (result.events) {
            for (const event of result.events) {
                // Look for PostCreated event
                if (event.type.includes("PostCreatedEvent") || event.type.includes("create_post") || event.type.includes("PostEvent")) {
                    // Try to get global post_id first, then fallback to id
                    if (event.data.post_id !== undefined) return Number(event.data.post_id);
                    if (event.data.id !== undefined) return Number(event.data.id);
                }
            }
        }
        
        return null;
    } catch (error: any) {
        console.error("Error creating post:", error);
        
        // Provide more specific error messages
        if (error?.name === 'WalletNotConnectedError' || error?.message?.includes('WalletNotConnected') || error?.message?.includes('not connected')) {
            throw new Error("Wallet is not connected. Please connect your wallet first.");
        }
        
        // Handle account_not_found error
        if (error?.error_code === 'account_not_found' || error?.message?.includes('Account not found')) {
            throw new Error("Account not found on blockchain. Please ensure your account has been initialized with at least one transaction.");
        }
        
        throw error;
    }
}

/**
 * Create a new comment on-chain
 */
export async function createCommentOnChain(
    parentId: number,
    content: string,
    imageUrl: string,
    signAndSubmitTransaction: (transaction: InputTransactionData) => Promise<any>
): Promise<void> {
    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) throw new Error("Mainnet contract address not configured. Please deploy the contract and update src/lib/movement.ts");

    // Check if signAndSubmitTransaction is available (wallet is connected)
    if (!signAndSubmitTransaction) {
        throw new Error("Wallet is not connected. Please connect your wallet first.");
    }

    // Explicitly define type arguments as empty
    const transaction: InputTransactionData = {
        data: {
            function: `${MODULE_ADDRESS}::${MODULE_NAME}::create_comment`,
            typeArguments: [],
            functionArguments: [parentId.toString(), parentId, content, imageUrl],
        },
    };

    try {
        const response = await signAndSubmitTransaction(transaction);
        const client = getClient();
        await client.waitForTransaction({ transactionHash: response.hash });

        // Dispatch event for UI refresh
        window.dispatchEvent(new Event('comment_added'));
    } catch (error: any) {
        console.error("Error creating comment:", error);
        
        // Provide more specific error messages
        if (error?.name === 'WalletNotConnectedError' || error?.message?.includes('WalletNotConnected') || error?.message?.includes('not connected')) {
            throw new Error("Wallet is not connected. Please connect your wallet first.");
        }
        
        throw error;
    }
}

/**
 * Delete a post on-chain
 */
export async function deletePostOnChain(
    postId: number,
    signAndSubmitTransaction: (transaction: InputTransactionData) => Promise<any>
): Promise<void> {
    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) throw new Error("Mainnet contract address not configured. Please deploy the contract and update src/lib/movement.ts");

    // Explicitly define type arguments as empty
    const transaction: InputTransactionData = {
        data: {
            function: `${MODULE_ADDRESS}::${MODULE_NAME}::delete_post`,
            typeArguments: [],
            functionArguments: [postId.toString()],
        },
    };

    try {
        const response = await signAndSubmitTransaction(transaction);
        const client = getClient();
        await client.waitForTransaction({ transactionHash: response.hash });
    } catch (error) {
        console.error("Error deleting post:", error);
        throw error;
    }
}

/**
 * Edit a post on-chain (with image support)
 */
export async function editPostOnChain(
    postId: number,
    content: string,
    imageUrl: string,
    signAndSubmitTransaction: (transaction: InputTransactionData) => Promise<any>
): Promise<void> {
    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) throw new Error("Mainnet contract address not configured. Please deploy the contract and update src/lib/movement.ts");

    // Explicitly define type arguments as empty
    const transaction: InputTransactionData = {
        data: {
            function: `${MODULE_ADDRESS}::${MODULE_NAME}::edit_post_with_image`,
            typeArguments: [],
            functionArguments: [postId.toString(), content, imageUrl],
        },
    };

    try {
        const response = await signAndSubmitTransaction(transaction);
        const client = getClient();
        await client.waitForTransaction({ transactionHash: response.hash });
    } catch (error) {
        console.error("Error editing post:", error);
        throw error;
    }
}


/**
 * Get the total number of global posts
 */
export async function getGlobalPostsCount(): Promise<number> {
    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) return 0;

    try {
        const client = getClient();
        const feed = await client.getAccountResource({
            accountAddress: MODULE_ADDRESS,
            resourceType: `${MODULE_ADDRESS}::move_feed_v13::GlobalFeed`
        }) as any;
        return Number(feed.post_counter);
    } catch (error: any) {
        if (isNotFound(error)) {
             return 0;
        }
        console.error("Error fetching global post count:", error);
        return 0;
    }
}

/**
 * Get a single post by global ID
 */
export async function getPost(postId: number): Promise<OnChainPost | null> {
    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) return null;

    try {
        const client = getClient();
        const feed = await client.getAccountResource({
            accountAddress: MODULE_ADDRESS,
            resourceType: `${MODULE_ADDRESS}::move_feed_v13::GlobalFeed`
        }) as any;

        const posts = feed.posts as any[];
        // Find post with id
        const post = posts.find((p: any) => Number(p.id) === postId);

        if (post) {
            return {
                id: Number(post.id),
                global_id: post.global_id !== undefined ? Number(post.global_id) : Number(post.id),
                creator: post.author || post.creator,
                content: getString(post.content),
                image_url: getString(post.image_url),
                style: Number(post.style || 1),
                total_tips: 0, // Not tracked in V12 Post struct
                timestamp: Number(post.timestamp),
                is_deleted: false,
                updated_at: Number(post.timestamp),
                last_tip_timestamp: 0,
                parent_id: 0,
                is_comment: false,
            };
        }
        return null;
    } catch (error: any) {
        if (isNotFound(error)) {
             return null;
        }
        console.error(`Error fetching post ${postId}:`, error);
        return null;
    }
}

/**
 * Get comments for a specific post
 */
export async function getCommentsForPost(parentId: number): Promise<OnChainPost[]> {
    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) return [];

    try {
        const client = getClient();
        const feed = await client.getAccountResource({
            accountAddress: MODULE_ADDRESS,
            resourceType: `${MODULE_ADDRESS}::move_feed_v13::GlobalFeed`
        }) as any;

        const allComments = feed.comments as any[];
        const comments = allComments.filter((c: any) => Number(c.parent_id) === parentId);

        return comments.map((comment: any) => ({
            id: Number(comment.id),
            global_id: Number(comment.id),
            creator: comment.author,
            content: getString(comment.content),
            image_url: "", // Comments don't have images in V12
            style: 1,
            total_tips: 0,
            timestamp: Number(comment.timestamp),
            is_deleted: false,
            updated_at: Number(comment.timestamp),
            last_tip_timestamp: 0,
            parent_id: Number(comment.parent_id),
            is_comment: true,
        })).sort((a, b) => b.timestamp - a.timestamp); // Newest first

    } catch (error: any) {
        if (isNotFound(error)) {
             return [];
        }
        console.error(`Error fetching comments for post ${parentId}:`, error);
        return [];
    }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries > 0 && error?.status === 429) {
            console.warn(`Rate limited, retrying in ${delay}ms...`);
            await sleep(delay);
            return retry(fn, retries - 1, delay * 2);
        }
        throw error;
    }
}

/**
 * Get global posts with pagination
 */
export async function getGlobalPosts(page: number = 0, limit: number = 10): Promise<OnChainPost[]> {
    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) return [];

    try {
        const client = getClient();
        const feed = await client.getAccountResource({
            accountAddress: MODULE_ADDRESS,
            resourceType: `${MODULE_ADDRESS}::move_feed_v13::GlobalFeed`
        }) as any;

        const allPosts = feed.posts as any[];
        
        // Sort by ID descending (assuming larger ID = newer) or timestamp
        // Using ID is safer if timestamp is same
        allPosts.sort((a: any, b: any) => Number(b.id) - Number(a.id));

        const start = page * limit;
        const end = start + limit;
        const pagePosts = allPosts.slice(start, end);

        return pagePosts.map((post: any) => ({
             id: Number(post.id),
             global_id: Number(post.id),
             creator: post.author,
             content: getString(post.content),
             image_url: getString(post.image_url),
             style: 1,
             total_tips: 0,
             timestamp: Number(post.timestamp),
             is_deleted: false,
             updated_at: Number(post.timestamp),
             last_tip_timestamp: 0,
             parent_id: 0,
             is_comment: false,
        }));

    } catch (error: any) {
        if (isNotFound(error)) {
             return [];
        }
        console.error("Error fetching global posts:", error);
        return [];
    }
}

/**
 * Get posts by a specific user (paginated)
 */
export async function getUserPostsPaginated(userAddress: string, start: number, limit: number): Promise<OnChainPost[]> {
    if (!isValidMovementAddress(userAddress)) return [];

    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) return [];

    try {
        const client = getClient();
        const feed = await client.getAccountResource({
            accountAddress: MODULE_ADDRESS,
            resourceType: `${MODULE_ADDRESS}::move_feed_v13::GlobalFeed`
        }) as any;

        const allPosts = feed.posts as any[];
        const normalizedUserAddr = convertToMovementAddress(userAddress);

        // Filter by author
        const userPosts = allPosts.filter((p: any) => p.author === normalizedUserAddr);
        
        // Sort descending
        userPosts.sort((a: any, b: any) => Number(b.id) - Number(a.id));

        // Slice
        const pagePosts = userPosts.slice(start, start + limit);

        return pagePosts.map((post: any) => ({
            id: Number(post.id),
            global_id: Number(post.id),
            creator: post.author,
            content: getString(post.content),
            image_url: getString(post.image_url),
            style: 1,
            total_tips: Number(post.total_tips || 0),
            timestamp: Number(post.timestamp),
            is_deleted: false,
            updated_at: Number(post.timestamp),
            last_tip_timestamp: 0,
            parent_id: 0,
            is_comment: false,
        }));

    } catch (error: any) {
        if (isNotFound(error)) {
             return [];
        }
        console.error("Error fetching user posts paginated:", error);
        return [];
    }
}

/**
 * Get all posts from all users
 * @deprecated Use getAllPostsPaginated instead for scalability
 */
export async function getAllPosts(): Promise<OnChainPost[]> {
    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) return [];

    try {
        const payload = {
            function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_all_posts` as `${string}::${string}::${string}`,
            functionArguments: [],
        };

        const client = getClient();
        const result = await client.view({ payload });
        const posts = result[0] as any[];

        // Removed debug console.log - use browser devtools if needed

        return posts
            .map((post: any) => ({
                id: Number(post.id),
                creator: post.author || post.creator,
                content: getString(post.content),
                image_url: getString(post.image_url),
                style: Number(post.style),
                total_tips: Number(post.total_tips),
                timestamp: Number(post.timestamp),
                is_deleted: post.is_deleted || false,
                updated_at: Number(post.updated_at || post.timestamp),
                last_tip_timestamp: Number(post.last_tip_timestamp || 0),
                parent_id: Number(post.parent_id || 0),
                is_comment: post.is_comment || false,
            }))
            .filter((post: OnChainPost) => !post.is_deleted)
            .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error: any) {
        if (isNotFound(error)) {
             return [];
        }
        console.error("Error fetching all posts:", error);
        return [];
    }
}

/**
 * Get posts by a specific user
 * @deprecated Use getUserPostsPaginated instead for scalability
 */
export async function getUserPosts(userAddress: string): Promise<OnChainPost[]> {
    if (!isValidMovementAddress(userAddress)) return [];

    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) return [];

    try {
        const payload = {
            function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_user_posts` as `${string}::${string}::${string}`,
            functionArguments: [convertToMovementAddress(userAddress)],
        };

        const client = getClient();
        const result = await client.view({ payload });
        const posts = result[0] as any[];

        return posts
            .map((post: any) => ({
                id: Number(post.id),
                creator: post.author || post.creator,
                content: getString(post.content),
                image_url: getString(post.image_url),
                style: Number(post.style),
                total_tips: Number(post.total_tips),
                timestamp: Number(post.timestamp),
                is_deleted: post.is_deleted || false,
                updated_at: Number(post.updated_at || post.timestamp),
                last_tip_timestamp: Number(post.last_tip_timestamp || 0),
                parent_id: Number(post.parent_id || 0),
                is_comment: post.is_comment || false,
            }))
            .filter((post: OnChainPost) => !post.is_deleted)
            .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error: any) {
        if (isNotFound(error)) {
             return [];
        }
        console.error("Error fetching user posts:", error);
        return [];
    }
}

/**
 * Get user's post count
 */
export async function getUserPostsCount(userAddress: string): Promise<number> {
    if (!isValidMovementAddress(userAddress)) return 0;

    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) return 0;

    try {
        const client = getClient();
        const feed = await client.getAccountResource({
            accountAddress: MODULE_ADDRESS,
            resourceType: `${MODULE_ADDRESS}::move_feed_v13::GlobalFeed`
        }) as any;

        const allPosts = feed.posts as any[];
        const normalizedUserAddr = convertToMovementAddress(userAddress);

        return allPosts.filter((p: any) => p.author === normalizedUserAddr).length;

    } catch (error: any) {
        if (error?.message?.includes("resource_not_found") || error?.error_code === "resource_not_found") {
             return 0;
        }
        console.error("Error fetching user posts count:", error);
        return 0;
    }
}

/**
 * Get display name for a user
 */
export async function getDisplayName(userAddress: string): Promise<string> {
    if (!isValidMovementAddress(userAddress)) return "";

    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) return "";

    const normalizedAddress = convertToMovementAddress(userAddress);
    const cacheKey = `name_${normalizedAddress}`;
    
    // Check cache first
    const cached = profileCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL && cached.name !== undefined) {
        return cached.name;
    }

    try {
        const client = getClient();
        const profile = await client.getAccountResource({
            accountAddress: normalizedAddress,
            resourceType: `${MODULE_ADDRESS}::move_feed_v13::Profile`
        }) as any;

        const name = getString(profile.name);
        
        // Cache the result (even if empty)
        const existing = profileCache.get(cacheKey) || { timestamp: Date.now() };
        existing.name = name;
        profileCache.set(cacheKey, existing);
        
        return name;
    } catch (error: any) {
        // Silence 404s (Profile not initialized) - this is normal for new users
        if (isNotFound(error)) {
            // Cache the "not found" result to avoid repeated requests
            const existing = profileCache.get(cacheKey) || { timestamp: Date.now() };
            existing.name = "";
            profileCache.set(cacheKey, existing);
            return "";
        }
        // Only log non-404 errors
        console.error("Error fetching display name:", error);
        return "";
    }
}

/**
 * Get user tip statistics from blockchain
 * Returns: [total_sent, total_received, tips_sent_count]
 */
export async function getUserTipStats(userAddress: string): Promise<{
    totalSent: number;
    totalReceived: number;
    tipsSentCount: number;
}> {
    if (!isValidMovementAddress(userAddress)) {
        return { totalSent: 0, totalReceived: 0, tipsSentCount: 0 };
    }

    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) {
        return { totalSent: 0, totalReceived: 0, tipsSentCount: 0 };
    }

    try {
        const client = getClient();
        const normalizedAddress = convertToMovementAddress(userAddress);
        let totalReceived = 0;
        let totalSent = 0;
        const tipsSentCount = 0; // Not available via simple resource lookup without indexer

        // 1. Get Total Received (from Registry)
        try {
            const registry = await client.getAccountResource({
                accountAddress: MODULE_ADDRESS,
                resourceType: `${MODULE_ADDRESS}::donations_v10::Registry`
            }) as any;

            if (registry && registry.total_tips && registry.total_tips.handle) {
                const item = await client.getTableItem({
                    handle: registry.total_tips.handle,
                    data: {
                        key_type: "address",
                        value_type: "u64",
                        key: normalizedAddress
                    }
                });
                totalReceived = parseInt(item as string);
            }
        } catch (e) {
            // Ignore (user might not have received any tips)
        }

        // 2. Get Total Sent (from TopTipperStats)
        try {
            const stats = await client.getAccountResource({
                accountAddress: MODULE_ADDRESS,
                resourceType: `${MODULE_ADDRESS}::donations_v10::TopTipperStats`
            }) as any;

            if (stats && stats.sent_counts && stats.sent_counts.handle) {
                const item = await client.getTableItem({
                    handle: stats.sent_counts.handle,
                    data: {
                        key_type: "address",
                        value_type: "u64",
                        key: normalizedAddress
                    }
                });
                totalSent = parseInt(item as string);
            }
        } catch (e) {
            // Ignore
        }

        return {
            totalSent,
            totalReceived,
            tipsSentCount,
        };
    } catch (error: any) {
        if (error?.status === 404 || error?.message?.includes("module_not_found") || error?.error_code === "module_not_found") {
             return { totalSent: 0, totalReceived: 0, tipsSentCount: 0 };
        }
        console.error("Error fetching user tip stats:", error);
        return { totalSent: 0, totalReceived: 0, tipsSentCount: 0 };
    }
}

export interface ProfileData {
    name: string;
    bio: string;
    avatar_url: string;
}

/**
 * Get a user's profile
 */
export async function getProfile(address: string): Promise<ProfileData | null> {
    if (!isValidMovementAddress(address)) return null;

    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) return null;

    const normalizedAddress = convertToMovementAddress(address);
    const cacheKey = `profile_${normalizedAddress}`;
    
    // Check cache first
    const cached = profileCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL && cached.profile !== undefined) {
        return cached.profile;
    }

    try {
        const client = getClient();
        const profile = await client.getAccountResource({
            accountAddress: normalizedAddress,
            resourceType: `${MODULE_ADDRESS}::move_feed_v13::Profile`
        }) as any;

        const profileData = {
            name: getString(profile.name),
            bio: getString(profile.bio),
            avatar_url: getString(profile.avatar_url),
        };
        
        // Cache the result
        const existing = profileCache.get(cacheKey) || { timestamp: Date.now() };
        existing.profile = profileData;
        profileCache.set(cacheKey, existing);
        
        return profileData;
    } catch (error: any) {
        // Silence 404s (Profile not initialized) - this is normal for new users
        if (isNotFound(error)) {
            // Cache null to avoid repeated requests
            const existing = profileCache.get(cacheKey) || { timestamp: Date.now() };
            existing.profile = null;
            profileCache.set(cacheKey, existing);
            return null;
        }
        // Only log non-404 errors
        console.error("Error fetching profile:", error);
        return null;
    }
}

/**
 * Set full user profile (name, bio, avatar)
 */
export async function setProfile(
    displayName: string,
    bio: string,
    avatarUrl: string,
    signAndSubmitTransaction: (transaction: InputTransactionData) => Promise<any>
): Promise<void> {
    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) throw new Error("Mainnet contract address not configured. Please deploy the contract and update src/lib/movement.ts");

    const transaction: InputTransactionData = {
        data: {
            function: `${MODULE_ADDRESS}::${MODULE_NAME}::update_profile`,
            functionArguments: [displayName, bio, avatarUrl],
        },
    };

    try {
        const response = await signAndSubmitTransaction(transaction);
        const client = getClient();
        await client.waitForTransaction({ transactionHash: response.hash });
        
        // Invalidate cache after profile update
        const normalizedAddress = convertToMovementAddress(address);
        profileCache.delete(`profile_${normalizedAddress}`);
        profileCache.delete(`name_${normalizedAddress}`);
        profileCache.delete(`avatar_${normalizedAddress}`);
    } catch (error) {
        console.error("Error setting profile:", error);
        throw error;
    }
}

/**
 * Set user display name
 * Updates the full profile, preserving other fields if they exist
 */
export async function setDisplayName(
    displayName: string,
    signAndSubmitTransaction: (transaction: InputTransactionData) => Promise<any>,
    userAddress?: string // Optional: if provided, we can fetch existing profile to preserve bio/avatar
): Promise<void> {
    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) throw new Error("Mainnet contract address not configured. Please deploy the contract and update src/lib/movement.ts");

    let bio = "";
    let avatarUrl = "";

    // If we have the user address, try to fetch existing profile data
    if (userAddress) {
        try {
            const profile = await getProfile(userAddress);
            if (profile) {
                bio = profile.bio;
                avatarUrl = profile.avatar_url;
            }
        } catch (e) {
            // Profile doesn't exist yet, will be created - this is normal for new users
        }
    }

    const transaction: InputTransactionData = {
        data: {
            function: `${MODULE_ADDRESS}::${MODULE_NAME}::update_profile`,
            functionArguments: [displayName, bio, avatarUrl],
        },
    };

    try {
        const response = await signAndSubmitTransaction(transaction);
        const client = getClient();
        await client.waitForTransaction({ transactionHash: response.hash });
        
        // Invalidate cache after profile update
        if (userAddress) {
            const normalizedAddress = convertToMovementAddress(userAddress);
            profileCache.delete(`profile_${normalizedAddress}`);
            profileCache.delete(`name_${normalizedAddress}`);
        }
    } catch (error) {
        console.error("Error setting display name:", error);
        throw error;
    }
}

/**
 * Set user avatar URL
 * Updates the full profile, preserving other fields if they exist
 */
export async function setAvatar(
    avatarUrl: string,
    signAndSubmitTransaction: (transaction: InputTransactionData) => Promise<any>,
    userAddress?: string // Optional: if provided, we can fetch existing profile to preserve name/bio
): Promise<void> {
    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) throw new Error("Mainnet contract address not configured. Please deploy the contract and update src/lib/movement.ts");

    let name = "";
    let bio = "";

    // If we have the user address, try to fetch existing profile data
    if (userAddress) {
        try {
            const profile = await getProfile(userAddress);
            if (profile) {
                name = profile.name;
                bio = profile.bio;
            }
        } catch (e) {
            // Profile doesn't exist yet, will be created - this is normal for new users
        }
    }

    const transaction: InputTransactionData = {
        data: {
            function: `${MODULE_ADDRESS}::${MODULE_NAME}::update_profile`,
            functionArguments: [name, bio, avatarUrl],
        },
    };

    try {
        const response = await signAndSubmitTransaction(transaction);
        const client = getClient();
        await client.waitForTransaction({ transactionHash: response.hash });
        
        // Invalidate cache after profile update
        if (userAddress) {
            const normalizedAddress = convertToMovementAddress(userAddress);
            profileCache.delete(`profile_${normalizedAddress}`);
            profileCache.delete(`avatar_${normalizedAddress}`);
        }
    } catch (error) {
        console.error("Error setting avatar:", error);
        throw error;
    }
}

/**
 * Get user avatar URL
 */
export async function getAvatar(userAddress: string): Promise<string> {
    // Return default for invalid address to avoid crash
    if (!isValidMovementAddress(userAddress)) {
        return `https://api.dicebear.com/7.x/identicon/svg?seed=${userAddress || 'default'}`;
    }

    const MODULE_ADDRESS = getModuleAddress();
    if (!MODULE_ADDRESS) {
        return `https://api.dicebear.com/7.x/identicon/svg?seed=${userAddress}`;
    }

    const normalizedAddress = convertToMovementAddress(userAddress);
    const cacheKey = `avatar_${normalizedAddress}`;
    
    // Check cache first
    const cached = profileCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL && cached.avatar !== undefined) {
        return cached.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${userAddress}`;
    }

    try {
        const client = getClient();
        const profile = await client.getAccountResource({
            accountAddress: normalizedAddress,
            resourceType: `${MODULE_ADDRESS}::move_feed_v13::Profile`
        }) as any;

        const avatarUrl = getString(profile.avatar_url);

        // Cache the result
        const existing = profileCache.get(cacheKey) || { timestamp: Date.now() };
        existing.avatar = avatarUrl || "";
        profileCache.set(cacheKey, existing);

        if (avatarUrl) {
            return avatarUrl;
        }
    } catch (error: any) {
        // Silence 404s (Profile not initialized) - this is normal for new users
        if (isNotFound(error)) {
            // Cache the "not found" result to avoid repeated requests
            const existing = profileCache.get(cacheKey) || { timestamp: Date.now() };
            existing.avatar = "";
            profileCache.set(cacheKey, existing);
        }
        // Silently fail and return default - no need to log 404s
    }

    // Generate a consistent avatar URL based on the user address
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${userAddress}`;
}

/**
 * Clear profile cache for a specific address (useful after profile updates)
 */
export function clearProfileCache(address?: string): void {
    if (address) {
        const normalizedAddress = convertToMovementAddress(address);
        profileCache.delete(`profile_${normalizedAddress}`);
        profileCache.delete(`name_${normalizedAddress}`);
        profileCache.delete(`avatar_${normalizedAddress}`);
    } else {
        // Clear all cache
        profileCache.clear();
    }
}
