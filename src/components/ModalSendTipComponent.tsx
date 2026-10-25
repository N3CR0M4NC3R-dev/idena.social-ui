
import { useState } from 'react';
import type { MouseEventLocal } from '../App.exports';

type ModalSendTipComponentProps = {
    modalSendTipRef: React.RefObject<{ location: string, postId: string } | undefined>,
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

        const location = modalSendTipRef.current?.location as string;
        const postId = modalSendTipRef.current?.postId as string;

        await submitSendTipHandler(location, postId, tipAmount);
        closeModal();
    };

    const handleChangeTipAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTipAmount(e.target.value);
        hasInsufficientFunds(e.target.value);
    };

    const hasInsufficientFunds = (tipAmountParam?: string) => {
        const tipAmountNum = tipAmountParam ? parseFloat(tipAmountParam) : parseFloat(tipAmount);
        const idenaWalletBalanceNum = parseFloat(idenaWalletBalance);
        const insufficientFundsCalculated = tipAmountNum > idenaWalletBalanceNum;
        setInsufficientFunds(insufficientFundsCalculated);
    };

    return (<>
        <div className="w-screen max-w-full sm:w-[600px]">
            <div className="sticky top-0 z-[5] flex h-[53px] items-center bg-canvas/65 pl-14 pr-4 backdrop-blur-md">
                <h2 className="text-xl/6 font-extrabold">Send Tip</h2>
            </div>
            <div className="px-4 pb-4 text-[15px]/5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-2xl border border-line px-4 py-3">
                    <p className="text-ink-muted">Idena wallet balance</p>
                    <p className="font-bold [word-break:break-all]">{idenaWalletBalance} <span className="[word-break:keep-all]">iDNA</span></p>
                </div>
                <label className="mt-5 block">
                    <span className="block">How much iDNA would you like to tip?</span>
                    <input className="form-field mt-2 w-32 text-[15px]" onKeyDown={(e) => !(/[0-9.]/.test(e.key) || e.key === 'Backspace') && e.preventDefault()} value={tipAmount} onChange={e => handleChangeTipAmount(e)} />
                </label>
                <div className="mt-5 flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
                    {insufficientFunds && <p className="mr-auto text-[13px] text-danger">Send Tip will likely fail due to insufficient balance.</p>}
                    <button type="button" className="btn-primary h-9 px-4 text-[15px]" onClick={(e) => localSubmitTipHandler(e)}>Send Tip</button>
                </div>
            </div>
        </div>
    </>);
}

export default ModalSendTipComponent;
