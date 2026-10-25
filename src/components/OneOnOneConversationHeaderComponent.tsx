import type { MouseEventLocal } from "../App.exports";
import { getIdentityStatus, getProfilePic } from "../logic/utils";
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
            pic={getProfilePic(conversationPartner)}
        />
        {!conversationPartner.pubkey && <div className="flex flex-wrap gap-x-2 pl-[52px] text-[13px]">
            <span className="text-danger">pubkey missing</span>
            <span className="cursor-pointer text-accent hover:underline" onClick={(e) => handleSubmitPubkeyModal(e, conversationPartner.address)}>Manually Provide Pubkey</span>
        </div>}
    </>);
}

export default OneOnOneConversationHeaderComponent;
