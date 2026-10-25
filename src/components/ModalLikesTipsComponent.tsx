
import type { MouseEventLocal } from '../App.exports';
import type { Message, Post, Poster, Tip } from '../logic/asyncUtils';
import { getDisplayAddressShort, getDisplayDateTime, getDisplayTipAmount, getIdentityStatus, getProfilePic } from '../logic/utils';
import { useNavigate } from 'react-router';
import ObjectUrlImageComponent from './ObjectUrlImageComponent';

type ModalLikesTipsComponentProps = {
    heading: string,
    modalItemsRef: React.RefObject<Post[] | Tip[] | Message[]>,
    postersRef: React.RefObject<Record<string, Poster>>,
    closeModal: () => void,
};

function ModalLikesTipsComponent(props: ModalLikesTipsComponentProps) {

    const {
        heading,
        modalItemsRef,
        postersRef,
        closeModal,
    } = props;

    const navigate = useNavigate();

    const handleClickAddress = (e: MouseEventLocal, to: string) => {
        e.stopPropagation();
        if (to !== location.pathname) {
            navigate(to);
            closeModal();
        }
    };

    return (<>
        <div className="w-screen max-w-full sm:w-[600px]">
            <div className="sticky top-0 z-[5] flex h-[53px] items-center bg-canvas/65 pl-14 pr-4 backdrop-blur-md">
                <h2 className="truncate text-xl/6 font-extrabold">{heading}</h2>
            </div>
            <ul className="max-h-[calc(100dvh-53px)] overflow-y-auto scrollbar-thin pb-2 sm:max-h-[min(25rem,calc(90vh-53px))]">
                {modalItemsRef!.current.map((item) => {
                    const address = (item as Post).poster ?? (item as Message).sender ?? (item as Tip).tipper;
                    const posterDetails = (item as Post).posterDetails_atTimeOfPost ?? (item as Message).sendersDetails_atTimeOfMessage ?? (item as Tip).tipperDetails_atTimeOfTip;
                    const posterDisplayAddress = getDisplayAddressShort(address);
                    const posterStake = posterDetails.stake;
                    const posterState = posterDetails.state;
                    const posterAge = posterDetails.age;
                    const posterPic = getProfilePic(postersRef.current[address], posterState);

                    const { displayDate, displayTime } = getDisplayDateTime(item.timestamp);
                    const detail = (item as Post | Message).message ?? getDisplayTipAmount((item as Tip).amount) + ' iDNA';

                    return (
                        <li key={item.txHash} className="flex items-center gap-3 px-4 py-3 hover:bg-ink/[0.03]">
                            <ObjectUrlImageComponent file={posterPic} className="size-10 flex-none rounded-full bg-surface object-cover" />
                            <div className="min-w-0 flex-1">
                                <p className="w-fit max-w-full truncate text-[15px]/5 font-bold text-ink hover:cursor-pointer hover:underline" onClick={(e) => handleClickAddress(e, `/profile/${address}`)}>{posterDisplayAddress}</p>
                                <p className="break-words text-[13px]/4 text-ink-muted">{`Age\u00a0${posterAge} · ${getIdentityStatus(posterState)} · Stake\u00a0${posterStake}`}</p>
                            </div>
                            <div className="min-w-0 max-w-[45%] flex-none text-right">
                                <p className="truncate text-[15px]/5 font-bold text-ink" title={detail}>{detail}</p>
                                <p className="truncate text-[13px]/4 text-ink-muted"><a className="hover:underline" href={`https://scan.idena.io/transaction/${item.txHash}`} target="_blank" rel="noopener noreferrer">{`${displayDate}, ${displayTime}`}</a></p>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    </>);
}

export default ModalLikesTipsComponent;
