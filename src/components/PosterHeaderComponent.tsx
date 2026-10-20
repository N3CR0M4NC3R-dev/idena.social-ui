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
        <div className="flex flex-row">
            <div className="w-15 flex-none flex flex-col">
                <div className="h-17 flex-none -mt-3">
                    <ObjectUrlImageComponent file={pic} />
                </div>
                <div className="flex-1"></div>
            </div>
            <div className="mr-3 flex-1 flex flex-col overflow-hidden">
                <div className="flex-none flex flex-col gap-x-3 items-start">
                    <p className="text-[18px] font-[600] hover:cursor-pointer hover:underline" onClick={(e) => handleClickAddress(e, `/profile/${address}`)}>{getDisplayAddress(address)}</p>
                    <div><p className="text-[11px]/4">{`Age: ${age}, Status: ${getIdentityStatus(state)}, Stake: ${stake}`}</p></div>
                    <div className="flex-1"></div>
                </div>
            </div>
        </div>
    </>);
}

export default PosterHeaderComponent;
