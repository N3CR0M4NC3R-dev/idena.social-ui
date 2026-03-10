
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

    const localSubmitTipHandler = async (e?: MouseEventLocal) => {
        e?.stopPropagation();

        const postId = modalSendTipRef.current?.postId as string;
        const sendTipFromBalance = inputUseBalance === idenaWalletBalanceKey;

        await submitSendTipHandler(postId, postId, tipAmount, sendTipFromBalance);
        closeModal();
    }

    const handleInputUseBalanceToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputUseBalance(event.target.value);
    };

    return (<>
        <div className="px-3">
            <p className="mb-2 text-center">Send Tip</p>
            <div className="text-[14px]">
                <div className="mb-3">
                    <p>Tips balance: <span className="[word-break:break-all]">{dna2numStr(tipsBalance)} <span className="[word-break:keep-all]">iDNA</span></span></p>
                    <p>Idena wallet balance (est.): <span className="[word-break:break-all]">{idenaWalletBalance} <span className="[word-break:keep-all]">iDNA</span></span></p>
                </div>
                <div className="mb-3">
                    <div>How much iDNA would you like to tip? <input className="w-16 h-5 rounded-sm py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" onKeyDown={(e) => !(/[0-9.]/.test(e.key) || e.key === 'Backspace') && e.preventDefault()} value={tipAmount} onChange={e => setTipAmount(e.target.value)} /></div>
                    <div className="flex flex-row gap-2">
                        <input id="inputUseTipsBalance" type="radio" name="inputUseBalance" value={tipsBalanceKey} checked={inputUseBalance === tipsBalanceKey} onChange={handleInputUseBalanceToggle} />
                        <label htmlFor="inputUseTipsBalance" className="flex-none text-right">Use tips balance</label>
                    </div>
                    <div className="flex flex-row gap-2">
                        <input id="inputUseIdenaWalletBalance" type="radio" name="inputUseBalance" value={idenaWalletBalanceKey} checked={inputUseBalance === idenaWalletBalanceKey} onChange={handleInputUseBalanceToggle} />
                        <label htmlFor="inputUseIdenaWalletBalance" className="flex-none text-right">Use Idena wallet balance</label>
                    </div>
                </div>
                <button className="h-7 w-20 my-1 px-2 text-[13px] rounded-md bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={(e) => localSubmitTipHandler(e)}>Send Tip</button>
            </div>
        </div>
    </>);
}

export default ModalSendTipComponent;
