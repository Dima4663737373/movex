import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function SavedMessagesPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/chat?user=saved');
    }, []);

    return (
        <>
            <Head>
                <title>Saved Messages - MoveX</title>
            </Head>
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
            </div>
        </>
    );
}
