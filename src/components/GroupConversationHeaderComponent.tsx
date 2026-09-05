import type { MouseEventLocal } from "../App.exports";
import { getDisplayAddressVeryShort } from "../logic/utils";
import type { Poster } from "../logic/asyncUtils";
import { useNavigate } from "react-router";

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
        <div className="mx-2 mb-2">
            <div className="flex flex-row overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500">
                {conversationPartners.map(conversationPartner => <>
                    <div className="w-15 flex-none flex flex-col">
                        <div className="h-17 flex-none -mt-3">
                            <img src={`https://robohash.org/${conversationPartner.address}?set=set1`} />
                        </div>
                        <div className="mb-2 text-center">
                            <p className="text-[10px] hover:cursor-pointer hover:underline" onClick={(e) => handleClickAddress(e, `/profile/${conversationPartner.address}`)}>{getDisplayAddressVeryShort(conversationPartner.address)}</p>
                        </div>
                        {!conversationPartner.pubkey && <div className="-mt-1 mb-2 text-center text-[11px]">
                            <p className="text-red-400">pubkey missing</p>
                            <p className="text-blue-400 hover:underline hover:cursor-pointer" onClick={(e) => handleSubmitPubkeyModal(e, conversationPartner.address)}>Fix here</p>
                        </div>}
                    </div>
                </>)}
            </div>
        </div>
    </>);
}

export default GroupConversationHeaderComponent;
