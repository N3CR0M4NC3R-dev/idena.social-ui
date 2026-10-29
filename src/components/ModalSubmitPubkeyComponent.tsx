import { useState } from "react";
import { extractSenderInfoFromRawTx } from "../logic/utils";
import { type Poster } from "../logic/asyncUtils";

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
        postersRef.current = { ...postersRef.current, [modalSubmitPubkeyRef.current.address]: { ...sender, pubkey: senderInfo.pubkey } };

        setRawTransactionError('');
        closeModal();
    };

    return (<>
        <div className="w-screen max-w-full sm:w-[600px]">
            <div className="sticky top-0 z-[5] flex h-[53px] items-center bg-canvas/65 pl-14 pr-4 backdrop-blur-md">
                <h2 className="text-xl/6 font-extrabold">Submit Pubkey</h2>
            </div>
            <div className="px-4 pb-4 text-[15px]/5">
                <p className="text-ink-muted">To manually submit the pubkey for this address <span className="text-ink [word-break:break-all]">{modalSubmitPubkeyRef.current.address}</span>, paste and submit a raw transaction where this address was the sender. Raw transactions can be found at <a className="text-link hover:underline hover:cursor-pointer" href="http://scan.idena.io" target="_blank">scan.idena.io</a></p>
                <textarea
                    id="submit-raw-transaction"
                    rows={4}
                    value={rawTransaction}
                    className="form-field mt-4 block resize-none text-[15px] field-sizing-content min-h-[104px] max-h-[520px] scrollbar-thin"
                    placeholder="Paste raw transaction here..."
                    onChange={(e) => setRawTransaction(e.target.value)}
                />
                <div className="mt-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
                    {rawTransactionError && <p className="mr-auto text-[13px] text-danger">{rawTransactionError}</p>}
                    <button type="button" className="btn-primary h-9 px-4 text-[15px]" onClick={() => localSubmitPubkeyHandler()}>Submit</button>
                </div>
            </div>
        </div>
    </>);
}

export default ModalSubmitPubkeyComponent;
