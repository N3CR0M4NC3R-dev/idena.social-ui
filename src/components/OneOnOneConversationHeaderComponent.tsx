import type { MouseEventLocal } from "../App.exports";
import { getIdentityStatus } from "../logic/utils";
import type { Poster } from "../logic/asyncUtils";
import PosterHeaderComponent from "./PosterHeaderComponent";

type OneOnOneConversationHeaderComponentProps = {
    conversationPartner: Poster,
    handleSubmitPubkeyModal: (e: MouseEventLocal, address: string) => void,
};

function OneOnOneConversationHeaderComponent(props: OneOnOneConversationHeaderComponentProps) {

    const {
        conversationPartner,
        handleSubmitPubkeyModal,
    } = props;

    return (<>
        <PosterHeaderComponent
            address={conversationPartner.address}
            age={conversationPartner.age}
            state={getIdentityStatus(conversationPartner.state)}
            stake={parseInt(conversationPartner.stake)}
        />
        {!conversationPartner.pubkey && <div className="ml-3 flex gap-2">
            <span className="text-[11px] text-red-400">pubkey missing</span>
            <span className="inline text-[11px] text-blue-400 hover:underline hover:cursor-pointer" onClick={(e) => handleSubmitPubkeyModal(e, conversationPartner.address)}>Manually Provide Pubkey</span>
        </div>}
    </>);
}

export default OneOnOneConversationHeaderComponent;
