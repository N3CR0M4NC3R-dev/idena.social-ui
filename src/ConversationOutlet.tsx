import { useNavigate, useParams } from "react-router";
import { useAppContext } from "./AppContext";
import ConversationComponent from "./components/ConversationComponent";
import PageHeaderComponent from "./components/PageHeaderComponent";
import LdsSpinnerComponent from "./components/LdsSpinnerComponent";

function ConversationOutlet() {
    const { conversationKey } = useParams();
    const navigate = useNavigate();

    const {
        conversationsRef,
        messageSettingsInvalid,
        noMorePastBlocks,
    } = useAppContext();

    const handleGoBack = () => {
        navigate(-1);
    };

    const conversation = conversationsRef.current[conversationKey!];

    const conversationUnavailable = messageSettingsInvalid
        ? <p className="px-8 py-6 text-center text-[15px] text-danger">Messaging is disabled because there is a problem with your settings. Please adjust your settings and return to this page.</p>
        : noMorePastBlocks
            ? <p className="px-8 py-6 text-center text-[15px] text-ink-muted">No messages found for this conversation yet.</p>
            : <>
                <LdsSpinnerComponent />
                <p className="px-8 pb-6 text-center text-[15px] text-ink-muted">This conversation hasn't loaded yet. It will appear here once its messages have been scanned. Use “Scan more past blocks” below to search further back.</p>
            </>;

    return (<>
        <PageHeaderComponent title="Conversation" onBack={handleGoBack} />
        {conversation ? <ConversationComponent
            conversationKey={conversationKey!}
            isConversationOutlet={true}
        /> : conversationUnavailable}
    </>);
}

export default ConversationOutlet;
