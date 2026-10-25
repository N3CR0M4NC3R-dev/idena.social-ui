import type { MouseEventLocal } from "../App.exports";
import { getDisplayAddressVeryShort, getProfilePic } from "../logic/utils";
import type { Poster } from "../logic/asyncUtils";
import { useNavigate } from "react-router";
import ObjectUrlImageComponent from "./ObjectUrlImageComponent";
import { UsersIcon } from "./icons";

type GroupConversationHeaderComponentProps = {
    conversationPartners: Poster[],
    handleSubmitPubkeyModal: (e: MouseEventLocal, address: string) => void,
};

function GroupConversationHeaderComponent(props: GroupConversationHeaderComponentProps) {
    const navigate = useNavigate();

    const {
        conversationPartners,
        handleSubmitPubkeyModal,
    } = props;

    const handleClickAddress = (e: MouseEventLocal, to: string) => {
        e.stopPropagation();
        if (to !== location.pathname) {
            navigate(to);
        }
    };

    return (<>
        <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                <UsersIcon className="size-4" />
                <span>Group</span>
            </div>
            <div className="flex flex-row gap-3 overflow-x-auto scrollbar-thin pb-1">
                {conversationPartners.map(conversationPartner => <div key={conversationPartner.address} className="flex w-16 flex-none flex-col items-center gap-1 text-center">
                    <ObjectUrlImageComponent className="size-10 rounded-full bg-surface object-cover" file={getProfilePic(conversationPartner)} />
                    <p className="whitespace-nowrap text-[12px] text-ink-muted hover:cursor-pointer hover:underline" onClick={(e) => handleClickAddress(e, `/profile/${conversationPartner.address}`)}>{getDisplayAddressVeryShort(conversationPartner.address)}</p>
                    {!conversationPartner.pubkey && <div className="text-[11px]/3.5">
                        <p className="text-danger">pubkey missing</p>
                        <p className="text-accent hover:cursor-pointer hover:underline" onClick={(e) => handleSubmitPubkeyModal(e, conversationPartner.address)}>Fix here</p>
                    </div>}
                </div>)}
            </div>
        </div>
    </>);
}

export default GroupConversationHeaderComponent;
