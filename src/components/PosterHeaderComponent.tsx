import { useNavigate } from "react-router";
import type { MouseEventLocal } from "../App.exports";
import { getDisplayAddress, getIdentityStatus } from "../logic/utils";
import ObjectUrlImageComponent from "./ObjectUrlImageComponent";

type PosterHeaderComponentProps = {
    address: string,
    age: number,
    state: string,
    stake: string | number,
    pic?: File,
};

function PosterHeaderComponent(props: PosterHeaderComponentProps) {
    const navigate = useNavigate();

    const {
        address,
        age,
        state,
        stake,
        pic,
    } = props;

    const handleClickAddress = (e: MouseEventLocal, to: string) => {
        e.stopPropagation();
        if (to !== location.pathname) {
            navigate(to);
        }
    };

    return (<>
        <div className="flex min-w-0 items-center gap-3">
            <ObjectUrlImageComponent className="size-10 flex-none rounded-full bg-surface object-cover" file={pic} />
            <div className="min-w-0 flex-1">
                <p className="w-fit max-w-full truncate text-[15px]/5 font-bold text-ink hover:cursor-pointer hover:underline" onClick={(e) => handleClickAddress(e, `/profile/${address}`)}>{getDisplayAddress(address)}</p>
                <p className="truncate text-[13px]/4 text-ink-muted">{`Age ${age} · ${getIdentityStatus(state)} · Stake ${stake}`}</p>
            </div>
        </div>
    </>);
}

export default PosterHeaderComponent;
