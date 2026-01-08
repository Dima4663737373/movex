/**
 * Movement Network RPC Proxy
 * 
 * This API route proxies requests to Movement Network RPC to avoid CORS issues
 * when making requests from the browser.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { MOVEMENT_TESTNET_RPC_DIRECT } from '@/lib/movement';
import { IncomingMessage } from 'http';

// Simple in-memory rate limiter
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_IP = 1000; // Increased to 1000 requests per minute per IP to prevent 429 errors during development

const requestCounts = new Map<string, { count: number; startTime: number }>();

export const config = {
  api: {
    bodyParser: false, // Disable body parsing to handle streams/binary data
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Rate Limiting
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const ipStr = Array.isArray(ip) ? ip[0] : ip;

    const now = Date.now();
    const record = requestCounts.get(ipStr);

    if (record) {
        if (now - record.startTime > RATE_LIMIT_WINDOW) {
            // Reset window
            requestCounts.set(ipStr, { count: 1, startTime: now });
        } else {
            if (record.count >= MAX_REQUESTS_PER_IP) {
                return res.status(429).json({ error: 'Too many requests' });
            }
            record.count++;
        }
    } else {
        requestCounts.set(ipStr, { count: 1, startTime: now });
    }

    // Set CORS headers immediately
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, x-aptos-chain-id, x-aptos-ledger-version');

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Only allow GET and POST methods
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get the path from the query parameter
    // Next.js catch-all routes put path segments in req.query.path as an array
    const { path } = req.query;

    if (!path) {
      console.error('[RPC Proxy] No path provided. Query:', req.query);
      return res.status(400).json({ error: 'Invalid path', query: req.query });
    }

    // Handle both array and string paths
    let pathArray: string[] = [];
    if (Array.isArray(path)) {
      pathArray = path;
    } else if (typeof path === 'string') {
      pathArray = [path];
    } else {
      console.error('[RPC Proxy] Invalid path format:', path);
      return res.status(400).json({ error: 'Invalid path format', path });
    }

    // Build the target URL
    // Path will be like ['v1', 'accounts', ...] or ['accounts', ...]
    // We do NOT remove 'v1' because MOVEMENT_TESTNET_RPC_DIRECT already includes it
    // and we want to append the path segments as they are.
    // However, if the path segments duplicate the 'v1' that is already in the base, 
    // we should be careful. But usually the SDK sends the path relative to the fullnode URL.
    
    // If MOVEMENT_TESTNET_RPC_DIRECT is "https://testnet.movementnetwork.xyz/v1"
    // And path is ['v1', 'view']
    // We want "https://testnet.movementnetwork.xyz/v1/view" (NOT /v1/v1/view)
    
    // So if the FIRST segment is 'v1', we should probably remove it IF the base already ends in 'v1'
    if (MOVEMENT_TESTNET_RPC_DIRECT.endsWith('/v1') && pathArray.length > 0 && pathArray[0] === 'v1') {
        pathArray.shift();
    }

    // For URL paths with Move resource types containing ::
    // We need to properly encode each segment
    const pathString = pathArray.map(segment => encodeURIComponent(segment)).join('/');

    // Build URL correctly
    let targetUrl = MOVEMENT_TESTNET_RPC_DIRECT;
    if (pathString) {
      targetUrl = `${targetUrl.replace(/\/$/, '')}/${pathString}`;
    }

    // Add query parameters if GET request
    if (req.method === 'GET') {
      const url = new URL(targetUrl);
      // We need to parse the query string manually since bodyParser is false
      // But req.query is still populated by Next.js from the URL
      Object.keys(req.query).forEach(key => {
        if (key !== 'path') {
          const value = req.query[key];
          if (Array.isArray(value)) {
            value.forEach(v => url.searchParams.append(key, v));
          } else if (value) {
            url.searchParams.append(key, value);
          }
        }
      });
      targetUrl = url.toString();
    }

    console.log(`[RPC Proxy] ${req.method} ${targetUrl}`);
    console.log(`[RPC Proxy] Path segments:`, pathArray);

    // Forward the request to Movement Network RPC
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

    const headers: Record<string, string> = {
      'Accept': req.headers.accept || 'application/json',
      'User-Agent': 'MicroThreads-Tips/1.0',
    };

    // Forward Content-Type if present
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: headers,
      signal: controller.signal,
    };

    // If POST, stream the body
    if (req.method === 'POST') {
      // @ts-ignore - fetch accepts ReadableStream/IncomingMessage in Node environment
      fetchOptions.body = req;
      // Important: duplex: 'half' is required for Node.js fetch with streams
      // @ts-ignore
      fetchOptions.duplex = 'half';
    }

    let response: Response;
    try {
      response = await fetch(targetUrl, fetchOptions);
    } catch (fetchError: any) {
      console.error('[RPC Proxy] Fetch error:', fetchError);
      clearTimeout(timeoutId);
      if (!res.headersSent) {
        return res.status(502).json({
          error: 'Failed to connect to Movement Network',
          message: fetchError instanceof Error ? fetchError.message : 'Unknown error',
          targetUrl
        });
      }
      throw fetchError;
    }

    clearTimeout(timeoutId);

    // Forward status
    res.status(response.status);
    
    // Don't log 404s for resources that may not be initialized yet - this is normal
    // Only log 404s for unexpected resources
    if (response.status === 404) {
      const isExpected404 = 
        targetUrl.includes('::Profile') || 
        targetUrl.includes('::CheckInState') ||
        targetUrl.includes('::Registry') ||
        targetUrl.includes('::TopTipperStats');
      
      if (!isExpected404) {
        console.warn(`[RPC Proxy] 404 from upstream: ${targetUrl}`);
      }
    }

    // Forward headers
    response.headers.forEach((value, key) => {
      // Skip some headers that might cause issues
      if (key !== 'content-encoding' && key !== 'content-length') {
        res.setHeader(key, value);
      }
    });

    // Stream the response back
    if (response.body) {
      // @ts-ignore - response.body is a ReadableStream
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.end();
    }

  } catch (error: any) {
    console.error('[RPC Proxy Error]', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to proxy request',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
