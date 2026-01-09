import Head from 'next/head';
import SavedMessagesView from "@/components/chat/SavedMessagesView";

export default function SavedMessagesPage() {
    return (
        <>
            <Head>
                <title>Saved Messages - MoveX</title>
            </Head>
            <div>
                <SavedMessagesView />
            </div>
        </>
    );
}
