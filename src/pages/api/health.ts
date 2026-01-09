// Health check endpoint to trigger rebuild (v2)
export default function handler(req: any, res: any) {
    res.status(200).json({ status: 'ok', timestamp: Date.now(), v: 2 });
}