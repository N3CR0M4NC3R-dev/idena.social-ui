
import { useState } from 'react';
import type { MouseEventLocal } from '../App.exports';
import type { Post } from '../logic/asyncUtils';
import { dna2numStr } from '../logic/utils';

type ModalSendTipComponentProps = {
    modalSendTipRef: React.RefObject<Post | undefined>,
    tipsBalance: string,
    idenaWalletBalance: string,
    submitSendTipHandler: (location: string, tipToPostId: string, tipAmount: string, sendTipFromBalance: boolean) => Promise<void>,
    closeModal: () => void,
};

const tipsBalanceKey = 'tipsBalance';
const idenaWalletBalanceKey = 'idenaWalletBalance';

function ModalSendTipComponent(props: ModalSendTipComponentProps) {

    const {
        modalSendTipRef,
        tipsBalance,
        idenaWalletBalance,
        submitSendTipHandler,
        closeModal,
    } = props;

    const [tipAmount, setTipAmount] = useState<string>('0');
    const [inputUseBalance, setInputUseBalance] = useState<string>(tipsBalanceKey);
    const [insufficientFunds, setInsufficientFunds] = useState<boolean>(false);

    const localSubmitTipHandler = async (e?: MouseEventLocal) => {
        e?.stopPropagation();

        const postId = modalSendTipRef.current?.postId as string;
        const sendTipFromBalance = inputUseBalance === tipsBalanceKey;

        await submitSendTipHandler(postId, postId, tipAmount, sendTipFromBalance);
        closeModal();
    }

    const handleInputUseBalanceToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputUseBalance(event.target.value);
        hasInsufficientFunds(undefined, event.target.value);
    };

    const handleChangeTipAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTipAmount(e.target.value);
        hasInsufficientFunds(e.target.value, undefined);
    }

    const hasInsufficientFunds = (tipAmountParam?: string, sendTipFromBalanceParam?: string) => {
        const tipAmountNum = tipAmountParam ? parseFloat(tipAmountParam) : parseFloat(tipAmount);
        const sendTipFromBalance = sendTipFromBalanceParam ? sendTipFromBalanceParam === tipsBalanceKey : inputUseBalance === tipsBalanceKey;

        if (sendTipFromBalance) {
            const tipsBalanceNum = parseFloat(dna2numStr(tipsBalance));
            const insufficientFundsCalculated = tipAmountNum > tipsBalanceNum;
            setInsufficientFunds(insufficientFundsCalculated);
        } else {
            const idenaWalletBalanceNum = parseFloat(idenaWalletBalance);
            const insufficientFundsCalculated = tipAmountNum > idenaWalletBalanceNum;
            setInsufficientFunds(insufficientFundsCalculated);
        }
    }

    return (<>
        <div className="px-3">
            <p className="mb-2 text-center">Send Tip</p>
            <div className="text-[14px]">
                <div className="mb-3">
                    <p>Tips balance: <span className="[word-break:break-all]">{dna2numStr(tipsBalance)} <span className="[word-break:keep-all]">iDNA</span></span></p>
                    <p>Idena wallet balance: <span className="[word-break:break-all]">{idenaWalletBalance} <span className="[word-break:keep-all]">iDNA</span></span></p>
                </div>
                <div className="mb-3">
                    <div>How much iDNA would you like to tip? <input className="w-16 h-5 py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" onKeyDown={(e) => !(/[0-9.]/.test(e.key) || e.key === 'Backspace') && e.preventDefault()} value={tipAmount} onChange={e => handleChangeTipAmount(e)} /></div>
                    <div className="flex flex-row gap-2">
                        <input id="inputUseTipsBalance" type="radio" name="inputUseBalance" value={tipsBalanceKey} checked={inputUseBalance === tipsBalanceKey} onChange={handleInputUseBalanceToggle} />
                        <label htmlFor="inputUseTipsBalance" className="flex-none text-right">Use tips balance</label>
                    </div>
                    <div className="flex flex-row gap-2">
                        <input id="inputUseIdenaWalletBalance" type="radio" name="inputUseBalance" value={idenaWalletBalanceKey} checked={inputUseBalance === idenaWalletBalanceKey} onChange={handleInputUseBalanceToggle} />
                        <label htmlFor="inputUseIdenaWalletBalance" className="flex-none text-right">Use Idena wallet balance</label>
                    </div>
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
