import { useState } from 'react';
import { Link } from 'react-router';
import type { RpcClient } from '../logic/asyncUtils';
import { checkWitnesses, sendVerificationTransaction } from '../logic/moderatorVerification';
import { getDisplayAddressShort } from '../logic/utils';

type ModalVerifyModeratorComponentProps = {
    rpcClient: RpcClient,
    postersAddress: string,
    makePostsWith: string,
    webAppUrl: string,
    callbackUrl: string,
    indexerApiUrlRef: React.RefObject<string>,
    verifiedHandler: () => void,
    closeModal: () => void,
};

type Status = { text: string, error?: boolean };

const CHECK_POLL_MS = 10_000;
const CHECK_TIMEOUT_MS = 5 * 60 * 1000;

// Asks a moderator to prove they own their address before hidden content is shown (docs/moderation.md, "Verifying that
// you own your address").
function ModalVerifyModeratorComponent(props: ModalVerifyModeratorComponentProps) {

    const {
        rpcClient,
        postersAddress,
        makePostsWith,
        webAppUrl,
        callbackUrl,
        indexerApiUrlRef,
        verifiedHandler,
        closeModal,
    } = props;

    const [status, setStatus] = useState<Status>();
    const [busy, setBusy] = useState(false);
    const [verified, setVerified] = useState(false);

    const sendTransaction = async () => {
        setBusy(true);
        setStatus({ text: 'Preparing…' });

        const { error } = await sendVerificationTransaction(rpcClient, postersAddress, webAppUrl, callbackUrl);
        if (error) {
            setStatus({ text: error, error: true });
            setBusy(false);
            return;
        }

        setStatus({ text: 'Sign the transaction in the Idena app tab. Waiting for it to be mined…' });

        const deadline = Date.now() + CHECK_TIMEOUT_MS;
        while (Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, CHECK_POLL_MS));
            if (await checkWitnesses(indexerApiUrlRef.current, postersAddress)) {
                setStatus({ text: 'Verified ✓' });
                setVerified(true);
                setBusy(false);
                verifiedHandler();
                return;
            }
        }

        setStatus({ text: 'Not seen after 5 minutes. If you signed it, it may still be on its way: Show will work once it\'s mined.', error: true });
        setBusy(false);
    };

    return (<>
        <div className="w-screen max-w-full sm:w-[600px]">
            <div className="sticky top-0 z-[5] flex h-[53px] items-center bg-canvas/65 pl-14 pr-4 backdrop-blur-md">
                <h2 className="text-xl/6 font-extrabold">View hidden posts</h2>
            </div>
            <div className="px-4 pb-4 text-[15px]/5">
                <p>{`Prove you own ${getDisplayAddressShort(postersAddress.toLowerCase())} to view hidden content.`}</p>
                {makePostsWith === 'rpc' ? <p className="mt-3 text-ink-muted">With Make posts with: RPC, your node's key verifies you automatically. If you still see this, your node can't sign for this address.</p> : <>
                    <section className="mt-4 rounded-2xl border border-line px-4 py-3">
                        <p className="font-bold">Use your private key</p>
                        <p className="mt-1 text-[13px] text-ink-muted">Free. Enter your encrypted key and password in Settings: they stay in this browser.</p>
                        <Link to="/settings" className="btn-outline mt-3 h-9 px-4 text-[15px]" onClick={closeModal}>Open Settings</Link>
                    </section>
                    <section className="mt-3 rounded-2xl border border-line px-4 py-3">
                        <p className="font-bold">Send a verification transaction</p>
                        <p className="mt-1 text-[13px] text-ink-muted">0 iDNA to yourself, signed in the Idena app: you only pay the fee.</p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                            <button type="button" className="btn-primary h-9 px-4 text-[15px]" disabled={busy || verified} onClick={sendTransaction}>Send</button>
                            {status && <p className={`text-[13px] ${status.error ? 'text-danger' : 'text-ink-muted'}`}>{status.text}</p>}
                        </div>
                    </section>
                    <p className="mt-3 text-[13px] text-ink-muted">Any post, like or moderation action you make from this browser also verifies you, once it's mined.</p>
                </>}
                <div className="mt-4 flex justify-end">
                    <button type="button" className="btn-outline h-9 px-4 text-[15px]" onClick={closeModal}>Close</button>
                </div>
            </div>
        </div>
    </>);
}

export default ModalVerifyModeratorComponent;
