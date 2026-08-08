import { useState } from "react";
import { extractSenderInfoFromRawTx } from "../logic/utils";
import type { Poster } from "../logic/asyncUtils";

type ModalSubmitPubkeyComponentProps = {
    modalSubmitPubkeyRef: React.RefObject<{ address: string; }>,
    postersRef: React.RefObject<Record<string, Poster>>,
    closeModal: () => void,
};

function ModalSubmitPubkeyComponent(props: ModalSubmitPubkeyComponentProps) {

    const {
        modalSubmitPubkeyRef,
        postersRef,
        closeModal,
    } = props;

    const [rawTransaction, setRawTransaction] = useState<string>('');
    const [rawTransactionError, setRawTransactionError] = useState<string>('');

    const localSubmitPubkeyHandler = () => {
        const senderInfo = extractSenderInfoFromRawTx(rawTransaction);

        if (!senderInfo.pubkey) {
            setRawTransactionError('Issue with raw transaction.');
            return;
        }

        if (senderInfo.address !== modalSubmitPubkeyRef.current.address) {
            setRawTransactionError('Address is not the tx sender.');
            return;
        }

        const sender = postersRef.current[modalSubmitPubkeyRef.current.address];
        sender.pubkey = senderInfo.pubkey;

        setRawTransactionError('');
        closeModal();
    }

    return (<>
        <div className="w-full sm:w-[500px] px-3">
            <p className="mb-2 text-center">Submit Pubkey</p>
            <div className="text-[14px]">
                <div className="mb-3">
                    <div>To manually submit the pubkey for this address {modalSubmitPubkeyRef.current.address}, paste and submit a raw transaction where this address was the sender. Raw transactions can be found at <a className="text-blue-400 hover:underline hover:cursor-pointer" href="http://scan.idena.io" target="_blank">scan.idena.io</a></div>
                </div>
                <div className="mb-3">
                    <textarea
                        id="submit-raw-transaction"
                        rows={4}
                        value={rawTransaction}
                        className="w-full field-sizing-content min-h-[104px] max-h-[520px] py-1 px-2 outline-1 placeholder:text-gray-500 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-corner]:bg-neutral-500"
                        placeholder="Paste raw transaction here..."
                        onChange={(e) => setRawTransaction(e.target.value)}
                    />
                    <button className="h-9 w-27 my-1 px-4 py-1 bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={() => localSubmitPubkeyHandler()}>Submit</button>
                    {rawTransactionError && <p className="text-[11px] text-red-400">{rawTransactionError}</p>}
                </div>
            </div>
        </div>
    </>);
}

export default ModalSubmitPubkeyComponent;
