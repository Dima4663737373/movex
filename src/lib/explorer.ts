
/**
 * Explorer link generation helper
 */

import { getStoredNetwork } from "./movement";

export type ExplorerType = 'movement' | 'aptos';

export function getExplorerLink(
    value: string, 
    type: 'tx' | 'address' | 'block', 
    explorer: ExplorerType = 'movement'
): string {
    // Determine network param based on current context
    const storedNetwork = getStoredNetwork();
    const networkParam = (storedNetwork as string) === 'mainnet' 
        ? '?network=mainnet' 
        : '?network=testnet'; // Changed from 'bardock+testnet' to 'testnet' as per user link example or standard

    // Official Movement Explorer
    if (explorer === 'movement') {
        const baseUrl = 'https://explorer.movementnetwork.xyz';
        switch (type) {
            case 'tx':
                return `${baseUrl}/txn/${value}${networkParam}`;
            case 'address':
                return `${baseUrl}/account/${value}${networkParam}`;
            case 'block':
                return `${baseUrl}/block/${value}${networkParam}`;
            default:
                return baseUrl;
        }
    }
    
    // Aptos Scan (fallback/alternative)
    if (explorer === 'aptos') {
        const baseUrl = 'https://aptoscan.com';
        // AptosScan network param might be different
        // Assuming custom network or similar
        const aptosNetworkParam = (storedNetwork as string) === 'mainnet' 
             ? '?network=custom&rpc=https://mainnet.movementnetwork.xyz/v1' 
             : '?network=custom&rpc=https://testnet.movementnetwork.xyz/v1';

        switch (type) {
            case 'tx':
                return `${baseUrl}/version/${value}${aptosNetworkParam}`; // AptosScan uses version for tx
            case 'address':
                return `${baseUrl}/account/${value}${aptosNetworkParam}`;
            case 'block':
                return `${baseUrl}/block/${value}${aptosNetworkParam}`;
            default:
                return baseUrl;
        }
    }

    return '#';
}
