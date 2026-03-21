
import type { MouseEventLocal } from '../App.exports';
import type { Post, Poster, Tip } from '../logic/asyncUtils';
import { getDisplayAddressShort, getDisplayDateTime, getDisplayTipAmount, parsePostMessage } from '../logic/utils';
import { useNavigate } from 'react-router';

type ModalLikesTipsComponentProps = {
    heading: string,
    modalItemsRef: React.RefObject<Post[] | Tip[]>,
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
        <ul className="max-h-100 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500">
            <li className="text-center">{heading}</li>
            {modalItemsRef!.current.map((item, index) => {
                const isLastItem = index === (modalItemsRef!.current.length - 1);
                const address = (item as Post).poster ?? (item as Tip).tipper;
                const poster = postersRef.current[address];
                const displayAddress = getDisplayAddressShort(poster.address);
                const { displayDate, displayTime } = getDisplayDateTime(item.timestamp);
                const parsedPostMessage = (item as Post).message ? parsePostMessage((item as Post).message) : undefined;
                const detail = parsedPostMessage ? (parsedPostMessage.text || (parsedPostMessage.image ? '[image attachment]' : '')) : getDisplayTipAmount((item as Tip).amount) + ' iDNA';

                return (
                    <li className="pl-2 pr-3">
                        <div className="h-7 flex flex-row">
                            <div className="w-6 flex-none flex flex-col">
                                <div className="flex-none">
                                    <img src={`https://robohash.org/${poster.address}?set=set1`} />
                                </div>
                                <div className="flex-1"></div>
                            </div>
                            <div className="mr-2 flex flex-col justify-center overflow-hidden">
                                <div className="flex flex-row items-center">
                                    <p className="text-[14px] font-[600] hover:cursor-pointer" onClick={(e) => handleClickAddress(e, `/address/${poster.address}`)}>{displayAddress}</p>
                                    <span className="ml-2 text-[10px]">{`(${poster.age}, ${poster.state}, ${parseInt(poster.stake)})`}</span>
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col justify-center text-right">
                                <p className="mt-1 mr-2 text-[10px] font-[700]">{detail}</p>
                            </div>
                            <div className="flex flex-col justify-center">
                                <p className="text-[10px]/6 text-stone-500 font-[700]"><a href={`https://scan.idena.io/transaction/${item.txHash}`} target="_blank">{`${displayDate}, ${displayTime}`}</a></p>
                            </div>
                        </div>
                        {!isLastItem && <hr className="text-gray-700" />}
                    </li>
                )
            })}
        </ul>
    </>);
}

export default ModalLikesTipsComponent;
