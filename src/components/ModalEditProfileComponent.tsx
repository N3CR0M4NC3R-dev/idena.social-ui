import Decimal from 'decimal.js';
import { useEffect, useState } from 'react';
import { getProfilePictureWithRpc, storeFileToIpfs, type RpcClient } from '../logic/asyncUtils';
import { getEditStanding, getVouchedPaymentWithRpc, makeProfilePicture, prepareProfileCall, PROFILE_BIO_MAX, PROFILE_NAME_RULE, readProfileWithRpc, waitForProfileCall, type PreparedProfileCall, type ProfileCall, type ProfileFields } from '../logic/profileEdit';
import ObjectUrlImageComponent from './ObjectUrlImageComponent';

type ModalEditProfileComponentProps = {
    rpcClient: RpcClient,
    postersAddress: string,
    makePostsWith: string,
    sendProfileCallHandler: (prepared: PreparedProfileCall) => Promise<{ error?: string }>,
    profileUpdatedHandler: () => Promise<void>,
};

type Section = 'name' | 'profile';
type Status = { text: string, error?: boolean };

// Sizes a call before the picture is uploaded: a CIDv1 such as the node's (bafkrei...) is 59 characters.
const PICTURE_URL_PLACEHOLDER = 'ipfs://' + 'b'.repeat(59);

function ModalEditProfileComponent(props: ModalEditProfileComponentProps) {

    const {
        rpcClient,
        postersAddress,
        makePostsWith,
        sendProfileCallHandler,
        profileUpdatedHandler,
    } = props;

    const address = postersAddress.toLowerCase();
    const canUpload = makePostsWith === 'rpc';

    const [saved, setSaved] = useState<ProfileFields>();
    const [name, setName] = useState('');
    const [bio, setBio] = useState('');
    const [pictureUrl, setPictureUrl] = useState('');
    const [picturePreview, setPicturePreview] = useState<File | null>(null);
    const [pictureToUpload, setPictureToUpload] = useState<File | null>(null);
    const [pastedPictureUrl, setPastedPictureUrl] = useState('');
    const [busy, setBusy] = useState<Section | ''>('');
    const [statuses, setStatuses] = useState<Partial<Record<Section, Status>>>({});
    const [isHuman, setIsHuman] = useState(true);
    const [vouchedPayment, setVouchedPayment] = useState<Decimal>();

    useEffect(() => {
        let ignore = false;

        (async () => {
            const [ profile, { own, standing } ] = await Promise.all([readProfileWithRpc(rpcClient, address), getEditStanding(rpcClient, address)]);
            const [ picture, payment ] = await Promise.all([
                getProfilePictureWithRpc(rpcClient, profile.picture, address),
                standing === 'vouched' ? getVouchedPaymentWithRpc(rpcClient) : undefined,
            ]);
            if (ignore) return;

            setIsHuman(own.state === 'Human');
            setVouchedPayment(payment);
            setSaved(profile);
            setName(profile.name);
            setBio(profile.bio);
            setPictureUrl(profile.picture);
            setPicturePreview(picture);
        })();

        return () => {
            ignore = true;
        };
    }, [rpcClient, address]);

    const setStatus = (section: Section, status?: Status) => setStatuses((current) => ({ ...current, [section]: status }));

    // Checks, sends and waits for one call; returns whether the contract shows the change.
    const runCall = async (section: Section, prepared: PreparedProfileCall) => {
        const { error } = await sendProfileCallHandler(prepared);
        if (error) {
            setStatus(section, { text: error, error: true });
            return false;
        }

        setStatus(section, { text: canUpload ? 'Sent. Waiting for the next block…' : 'Sign the transaction in the Idena app tab. Waiting for it to reach a block…' });

        if (!await waitForProfileCall(rpcClient, address, prepared.call)) {
            setStatus(section, { text: 'Not confirmed after 5 minutes. If you signed it, check it in the explorer: the contract may have refused it.', error: true });
            return false;
        }

        await profileUpdatedHandler();
        setStatus(section, { text: 'Saved.' });
        return true;
    };

    const saveName = async (call: ProfileCall) => {
        setBusy('name');
        setStatus('name', { text: 'Checking…' });

        const prepared = await prepareProfileCall(rpcClient, address, call);
        if (prepared.error) {
            setStatus('name', { text: prepared.error, error: true });
        } else if (await runCall('name', prepared)) {
            const newName = call.method === 'claimName' ? call.args.name : '';
            setSaved((current) => current && { ...current, name: newName });
            setName(newName);
        }

        setBusy('');
    };

    const saveProfile = async () => {
        setBusy('profile');
        setStatus('profile', { text: 'Checking…' });

        const call: ProfileCall = { method: 'setProfile', args: { bio, picture: pictureToUpload ? PICTURE_URL_PLACEHOLDER : pictureUrl } };
        let prepared = await prepareProfileCall(rpcClient, address, call);

        if (!prepared.error && pictureToUpload) {
            setStatus('profile', { text: 'Uploading the picture…' });
            const uploadedUrl = await storeFileToIpfs(rpcClient, new Uint8Array(await pictureToUpload.arrayBuffer()), address);

            prepared = uploadedUrl
                ? { ...prepared, call: { method: 'setProfile', args: { bio, picture: uploadedUrl } } }
                : { ...prepared, error: 'The picture could not be uploaded to IPFS. Try again.' };
        }

        if (prepared.error) {
            setStatus('profile', { text: prepared.error, error: true });
        } else if (prepared.call.method === 'setProfile') {
            const newPictureUrl = prepared.call.args.picture;
            setPictureUrl(newPictureUrl);
            setPictureToUpload(null);

            if (await runCall('profile', prepared)) {
                setSaved((current) => current && { ...current, bio, picture: newPictureUrl });
            }
        }

        setBusy('');
    };

    const choosePicture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.currentTarget.files?.[0];
        e.currentTarget.value = '';
        if (!file) return;

        try {
            const picture = await makeProfilePicture(file);
            setPictureToUpload(picture);
            setPicturePreview(picture);
            setStatus('profile');
        } catch (error) {
            setStatus('profile', { text: error instanceof Error ? error.message : 'This image cannot be used.', error: true });
        }
    };

    const usePastedPicture = async () => {
        const url = pastedPictureUrl.trim();
        setStatus('profile', { text: 'Loading the picture…' });

        const picture = await getProfilePictureWithRpc(rpcClient, url, address);
        if (!picture) {
            setStatus('profile', { text: 'No usable picture there. It must be an ipfs:// link to a still WebP, 256×256 or smaller, of at most 32 KB.', error: true });
            return;
        }

        setPictureUrl(url);
        setPicturePreview(picture);
        setPastedPictureUrl('');
        setStatus('profile');
    };

    const removePicture = () => {
        setPictureUrl('');
        setPictureToUpload(null);
        setPicturePreview(null);
    };

    const nameChanged = !!saved && name !== saved.name;
    const profileChanged = !!saved && (bio !== saved.bio || pictureUrl !== saved.picture || !!pictureToUpload);

    const statusLine = (section: Section) => {
        const status = statuses[section];
        return status && <p className={`mr-auto text-[13px] ${status.error ? 'text-danger' : 'text-ink-muted'}`}>{status.text}</p>;
    };

    return (<>
        <div className="w-screen max-w-full sm:w-[600px]">
            <div className="sticky top-0 z-[5] flex h-[53px] items-center bg-canvas/65 pl-14 pr-4 backdrop-blur-md">
                <h2 className="text-xl/6 font-extrabold">Edit profile</h2>
            </div>
            {!saved && <p className="px-4 pb-4 text-[15px]/5 text-ink-muted">Loading your profile…</p>}
            {saved && <div className="px-4 pb-4 text-[15px]/5">
                <section>
                    <label className="block">
                        <span className="block font-bold">Name</span>
                        <input
                            className="form-field mt-2 text-[15px]"
                            placeholder="your_name"
                            maxLength={20}
                            value={name}
                            disabled={!!busy}
                            onChange={(e) => setName(e.target.value.toLowerCase())}
                        />
                    </label>
                    <p className="mt-1 text-[13px] text-ink-muted">3 to 20 characters: a-z, 0-9 and _. One change per epoch; a name you leave stays blocked for 2 epochs.</p>
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
                        {statusLine('name')}
                        {saved.name && <button type="button" className="btn-outline h-9 px-4 text-[15px]" disabled={!!busy} onClick={() => saveName({ method: 'dropName' })}>Remove name</button>}
                        <button type="button" className="btn-primary h-9 px-4 text-[15px]" disabled={!!busy || !nameChanged || !PROFILE_NAME_RULE.test(name)} onClick={() => saveName({ method: 'claimName', args: { name } })}>Save name</button>
                    </div>
                </section>
                <section className="mt-5 border-t border-line pt-4">
                    <span className="block font-bold">Picture</span>
                    <div className="mt-2 flex items-center gap-4">
                        <ObjectUrlImageComponent className="size-20 flex-none rounded-full bg-surface object-cover" file={picturePreview ?? undefined} />
                        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                            {canUpload && <>
                                <label htmlFor="edit-profile-picture" className={`btn-outline h-9 px-4 text-[15px] ${busy ? 'pointer-events-none opacity-50' : ''}`}>Choose image</label>
                                <input id="edit-profile-picture" type="file" accept="image/*" className="hidden" disabled={!!busy} onChange={choosePicture} />
                            </>}
                            {!canUpload && <div className="flex w-full gap-2">
                                <input className="form-field min-w-0 flex-1 text-[15px]" placeholder="ipfs://cid" value={pastedPictureUrl} disabled={!!busy} onChange={(e) => setPastedPictureUrl(e.target.value)} />
                                <button type="button" className="btn-outline h-9 flex-none px-4 text-[15px]" disabled={!!busy || !pastedPictureUrl.trim()} onClick={usePastedPicture}>Use</button>
                            </div>}
                            {picturePreview && <button type="button" className="btn-outline h-9 px-4 text-[15px]" disabled={!!busy} onClick={removePicture}>Remove</button>}
                        </div>
                    </div>
                    {!isHuman && <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-[13px] text-ink">You are not Human yet, so your picture will only be visible once you reach Human status.</p>}
                    <p className="mt-2 text-[13px] text-ink-muted">
                        Shown while you are Human, and on posts you made as a Human.
                        {canUpload ? ' Your image is cropped to a 256×256 WebP of at most 32 KB and stored on IPFS.' : ' Uploading needs Make posts with: RPC (the public node cannot store files). Here you can use an image already on IPFS: a still WebP, 256×256 or smaller, of at most 32 KB.'}
                    </p>
                    <label className="mt-4 block">
                        <span className="block font-bold">Bio</span>
                        <textarea
                            className="form-field mt-2 block min-h-24 resize-y text-[15px]"
                            maxLength={PROFILE_BIO_MAX}
                            value={bio}
                            disabled={!!busy}
                            onChange={(e) => setBio(e.target.value)}
                        />
                    </label>
                    <p className="mt-1 text-right text-[13px] text-ink-muted">{bio.length}/{PROFILE_BIO_MAX}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
                        {statusLine('profile')}
                        <button type="button" className="btn-primary h-9 px-4 text-[15px]" disabled={!!busy || !profileChanged} onClick={saveProfile}>Save bio and picture</button>
                    </div>
                </section>
                <p className="mt-5 border-t border-line pt-4 text-[13px] text-ink-muted">Each save is a transaction, about 1 iDNA. Your balance must also cover its max fee, up to about 7 iDNA the first time in an epoch; only the gas used is charged. Changes show after the next block.{vouchedPayment && ` As a vouched member, saving your name or your bio and picture also sends about ${vouchedPayment.toDecimalPlaces(2, Decimal.ROUND_UP)} iDNA, which the contract burns.`}</p>
            </div>}
        </div>
    </>);
}

export default ModalEditProfileComponent;
