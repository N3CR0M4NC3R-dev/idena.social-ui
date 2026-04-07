
import { useState } from 'react';
import type { MouseEventLocal } from '../App.exports';
import type { Post } from '../logic/asyncUtils';

type ModalSendTipComponentProps = {
    modalSendTipRef: React.RefObject<Post | undefined>,
    idenaWalletBalance: string,
    submitSendTipHandler: (location: string, tipToPostId: string, tipAmount: string) => Promise<void>,
    closeModal: () => void,
};

function ModalSendTipComponent(props: ModalSendTipComponentProps) {

    const {
        modalSendTipRef,
        idenaWalletBalance,
        submitSendTipHandler,
        closeModal,
    } = props;

    const [tipAmount, setTipAmount] = useState<string>('0');
    const [insufficientFunds, setInsufficientFunds] = useState<boolean>(false);

    const localSubmitTipHandler = async (e?: MouseEventLocal) => {
        e?.stopPropagation();

        const postId = modalSendTipRef.current?.postId as string;

        await submitSendTipHandler(postId, postId, tipAmount);
        closeModal();
    }

    const handleChangeTipAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTipAmount(e.target.value);
        hasInsufficientFunds(e.target.value);
    }

    const hasInsufficientFunds = (tipAmountParam?: string) => {
        const tipAmountNum = tipAmountParam ? parseFloat(tipAmountParam) : parseFloat(tipAmount);
        const idenaWalletBalanceNum = parseFloat(idenaWalletBalance);
        const insufficientFundsCalculated = tipAmountNum > idenaWalletBalanceNum;
        setInsufficientFunds(insufficientFundsCalculated);
    }

    return (<>
        <div className="px-3">
            <p className="mb-2 text-center">Send Tip</p>
            <div className="text-[14px]">
                <div className="mb-3">
                    <p>Idena wallet balance: <span className="[word-break:break-all]">{idenaWalletBalance} <span className="[word-break:keep-all]">iDNA</span></span></p>
                </div>
                <div className="mb-3">
                    <div>How much iDNA would you like to tip? <input className="w-16 h-5 py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" onKeyDown={(e) => !(/[0-9.]/.test(e.key) || e.key === 'Backspace') && e.preventDefault()} value={tipAmount} onChange={e => handleChangeTipAmount(e)} /></div>
                </div>
                <div className="h-10 flex flex-row">
                    <button className="h-7 w-20 my-1 px-2 text-[13px] bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={(e) => localSubmitTipHandler(e)}>Send Tip</button>
                    {insufficientFunds && <div className="flex flex-col justify-center"><p className="ml-2 text-[11px] text-red-400">Send Tip will likely fail due to insufficent balance.</p></div>}
                </div>
            </div>
        </div>
    </>);
}

export default ModalSendTipComponent;
