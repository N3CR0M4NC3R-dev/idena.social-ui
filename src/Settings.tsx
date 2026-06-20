import { useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router";

type SettingsProps = {
    inputNodeApplied: boolean,
    nodeUrl: string,
    setNodeUrl: React.Dispatch<React.SetStateAction<string>>,
    nodeAvailable: boolean,
    nodeKey: string,
    setNodeKey: React.Dispatch<React.SetStateAction<string>>,
    setInputNodeApplied: React.Dispatch<React.SetStateAction<boolean>>,
    makePostsWith: string,
    handleMakePostsWithToggle: (event: React.ChangeEvent<HTMLInputElement, Element>) => void,
    viewOnlyNode: boolean,
    inputPostersAddressApplied: boolean,
    inputPostersAddress: string,
    setInputPostersAddress: React.Dispatch<React.SetStateAction<string>>,
    postersAddressInvalid: boolean,
    setInputPostersAddressApplied: React.Dispatch<React.SetStateAction<boolean>>,
    findPostsWith: string,
    handleInputFindPostsWithToggle: (event: React.ChangeEvent<HTMLInputElement, Element>) => void,
    inputIdenaIndexerApiUrlApplied: boolean,
    inputIdenaIndexerApiUrl: string,
    setInputIdenaIndexerApiUrl: React.Dispatch<React.SetStateAction<string>>,
    indexerApiUrlInvalid: boolean,
    setInputIdenaIndexerApiUrlApplied: React.Dispatch<React.SetStateAction<boolean>>,
    encryptedPrivateKey: string,
    setEncryptedPrivateKey: React.Dispatch<React.SetStateAction<string>>,
    password: string,
    setPassword: React.Dispatch<React.SetStateAction<string>>,
    inputCredentialsApplied: boolean,
    credentialsInvalid: string,
    saveEncryptedKey: boolean,
    setSaveEncryptedKey: React.Dispatch<React.SetStateAction<boolean>>,
    savePassword: boolean,
    setSavePassword: React.Dispatch<React.SetStateAction<boolean>>,
    handleSetInputCredentialsApplied: (newValue: boolean) => Promise<void>,
};

function Settings() {
    const navigate = useNavigate();

    const {
        inputNodeApplied,
        nodeUrl,
        setNodeUrl,
        nodeAvailable,
        nodeKey,
        setNodeKey,
        setInputNodeApplied,
        makePostsWith,
        handleMakePostsWithToggle,
        viewOnlyNode,
        inputPostersAddressApplied,
        inputPostersAddress,
        setInputPostersAddress,
        postersAddressInvalid,
        setInputPostersAddressApplied,
        findPostsWith,
        handleInputFindPostsWithToggle,
        inputIdenaIndexerApiUrlApplied,
        inputIdenaIndexerApiUrl,
        setInputIdenaIndexerApiUrl,
        indexerApiUrlInvalid,
        setInputIdenaIndexerApiUrlApplied,
        encryptedPrivateKey,
        setEncryptedPrivateKey,
        password,
        setPassword,
        inputCredentialsApplied,
        credentialsInvalid,
        saveEncryptedKey,
        setSaveEncryptedKey,
        savePassword,
        setSavePassword,
        handleSetInputCredentialsApplied,
    } = useOutletContext() as SettingsProps;

    const onChangeSaveEncryptedKeyHandler = () => {
        const newSaveEncryptedKey = !saveEncryptedKey;
        setSaveEncryptedKey(newSaveEncryptedKey);
        localStorage.setItem('saveEncryptedKey', `${newSaveEncryptedKey}`);
        localStorage.setItem('encryptedPrivateKey', newSaveEncryptedKey ? encryptedPrivateKey : '');
    };

    const onChangeSavePasswordHandler = () => {
        const newSavePassword = !savePassword;
        setSavePassword(newSavePassword);
        localStorage.setItem('savePassword', `${newSavePassword}`);
        localStorage.setItem('password', newSavePassword ? password : '');
    };

    const handleGoBack = () => {
        navigate(-1);
    };

    useEffect(() => {
        handleSetInputCredentialsApplied(true);
    }, []);

    return (<>
        <button className="mb-4 text-[13px] hover:cursor-pointer hover:underline" onClick={handleGoBack}>&lt; Back</button>
        <div className="mb-4 text-[14px]">
            <div className="flex flex-col">
                <div className="flex flex-row mb-2 gap-1">
                    <p className="w-13 flex-none text-right">Rpc url:</p>
                    <input className="flex-1 py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputNodeApplied} value={nodeUrl} onChange={e => setNodeUrl(e.target.value)} />
                </div>
                <div className="flex flex-row mb-1 gap-1">
                    <p className="w-13 flex-none text-right">Api key:</p>
                    <input className="flex-1 py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputNodeApplied} value={nodeKey} onChange={e => setNodeKey(e.target.value)} />
                </div>
                {!nodeAvailable && <p className="ml-14 text-[11px] text-red-400">Node Unavailable. Please try again.</p>}
            </div>
            <div className="flex flex-row">
                <button className={`h-7 w-16 ml-14 mt-1 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer ${inputNodeApplied ? 'bg-white/10' : 'bg-white/30'}`} onClick={() => setInputNodeApplied(!inputNodeApplied)}>{inputNodeApplied ? 'Change' : 'Apply!'}</button>
                {!inputNodeApplied && <p className="w-18 ml-1.5 mt-1 text-gray-400 text-[11px]/3.5">Apply changes to take effect</p>}
            </div>
        </div>
        <hr className="mb-3 text-gray-500" />
        <div className="flex flex-col mb-6">
            <p>Make posts with:</p>
            <div className="flex flex-row gap-2">
                <input id="useRpc" type="radio" name="useRpc" value="rpc" checked={makePostsWith === 'rpc'} onChange={handleMakePostsWithToggle} />
                <label htmlFor="useRpc" className="flex-none text-right">RPC</label>
            </div>
            {makePostsWith === 'rpc' && viewOnlyNode && <p className="ml-4.5 text-[11px] text-red-400">Your RPC is View-Only. Switch to: Idena Web App for making posts. (Posting, liking, tipping is disabled)</p>}
            <div className="flex flex-row gap-2">
                <input id="notUseRpc" type="radio" name="useRpc" value="idena-app" checked={makePostsWith === 'idena-app'} onChange={handleMakePostsWithToggle} />
                <label htmlFor="notUseRpc" className="flex-none text-right">Idena Web App</label>
            </div>
            {makePostsWith === 'idena-app' && (<>
                <div className="mb-4 flex flex-col ml-5 text-[14px]">
                    <p className="mb-1">Your Idena Address:</p>
                    <input className="flex-1 mb-1 py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputPostersAddressApplied} value={inputPostersAddress} onChange={e => setInputPostersAddress(e.target.value)} />
                    {postersAddressInvalid && <p className="text-[11px] text-red-400">Invalid address. (Posting, liking, tipping is disabled)</p>}
                    <div className="flex flex-row">
                        <button className={`h-7 w-16 mt-1 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer ${inputPostersAddressApplied ? 'bg-white/10' : 'bg-white/30'}`} onClick={() => setInputPostersAddressApplied(!inputPostersAddressApplied)}>{inputPostersAddressApplied ? 'Change' : 'Apply'}</button>
                        {!inputPostersAddressApplied && <p className="w-18 ml-1.5 mt-1 text-gray-400 text-[11px]/3.5">Apply changes to take effect</p>}
                    </div>
                </div>
                <div className="flex flex-col ml-5 text-[14px]">
                    <p className="mb-1">Encrypted private key:</p>
                    <input className="flex-1 mb-1 py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputCredentialsApplied} value={encryptedPrivateKey} onChange={e => setEncryptedPrivateKey(e.target.value)} />
                    <p className="mb-1">Password:</p>
                    <input type="password" className="flex-1 mb-1 py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputCredentialsApplied} value={password} onChange={e => setPassword(e.target.value)} />
                    <div className="flex flex-row">
                        <button className={`h-7 w-16 mt-1 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer ${inputCredentialsApplied ? 'bg-white/10' : 'bg-white/30'}`} onClick={() => handleSetInputCredentialsApplied(!inputCredentialsApplied)}>{inputCredentialsApplied ? 'Change' : 'Apply'}</button>
                        {!inputCredentialsApplied && <p className="w-18 ml-1.5 mt-1 text-gray-400 text-[11px]/3.5">Apply changes to take effect</p>}
                    </div>
                    {credentialsInvalid && inputCredentialsApplied && <p className="mt-1 text-[11px] text-red-400">Invalid credentials: {credentialsInvalid}. (Messaging is disabled)</p>}
                    <div className="mt-2 flex flex-row gap-2 items-center">
                        <div className="group grid size-4 grid-cols-1">
                            <input
                                id="saveEncryptedKey"
                                type="checkbox"
                                name="saveEncryptedKey"
                                checked={saveEncryptedKey}
                                aria-describedby="comments-description"
                                className="col-start-1 row-start-1 appearance-none rounded-sm border border-white/10 bg-white/5 checked:border-blue-500 checked:bg-blue-500 indeterminate:border-blue-500 indeterminate:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:border-white/5 disabled:bg-white/10 disabled:checked:bg-white/10 forced-colors:appearance-auto"
                                onChange={onChangeSaveEncryptedKeyHandler}
                            />
                            <svg viewBox="0 0 14 14" fill="none" className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-white/25">
                                <path d="M3 8L6 11L11 3.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="opacity-0 group-has-checked:opacity-100" />
                                <path d="M3 7H11" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="opacity-0 group-has-indeterminate:opacity-100" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <label htmlFor="saveEncryptedKey">Save the encrypted key in browser localStorage</label>
                        </div>
                    </div>
                    <div className="mt-2 flex flex-row gap-2 items-center">
                        <div className="group grid size-4 grid-cols-1">
                            <input
                                id="savePassword"
                                type="checkbox"
                                name="savePassword"
                                checked={savePassword}
                                aria-describedby="comments-description"
                                className="col-start-1 row-start-1 appearance-none rounded-sm border border-white/10 bg-white/5 checked:border-blue-500 checked:bg-blue-500 indeterminate:border-blue-500 indeterminate:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:border-white/5 disabled:bg-white/10 disabled:checked:bg-white/10 forced-colors:appearance-auto"
                                onChange={onChangeSavePasswordHandler}
                            />
                            <svg viewBox="0 0 14 14" fill="none" className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-white/25">
                                <path d="M3 8L6 11L11 3.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="opacity-0 group-has-checked:opacity-100" />
                                <path d="M3 7H11" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="opacity-0 group-has-indeterminate:opacity-100" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <label htmlFor="savePassword">Save the password in browser localStorage</label>
                        </div>
                    </div>
                    <p className="ml-6 text-[12px]">(Note: There is a heightened risk when saving both the encrypted key and password. Only do this with accounts possessing small amounts of idna.)</p>
                </div>
            </>)}
        </div>
        <hr className="mb-3 text-gray-500" />
        <div className="flex flex-col mb-6">
            <p>Find posts with:</p>
            <div className="flex flex-row gap-2">
                <input id="findPostsWith" type="radio" name="findPostsWith" value="rpc" checked={findPostsWith === 'rpc'} onChange={handleInputFindPostsWithToggle} />
                <label htmlFor="findPostsWith" className="flex-none text-right">RPC</label>
            </div>
            <div className="flex flex-row gap-2">
                <input id="notUseFindPastBlocksWithTxsApi" type="radio" name="findPostsWith" value="indexer-api" checked={findPostsWith === 'indexer-api'} onChange={handleInputFindPostsWithToggle} />
                <label htmlFor="notUseFindPastBlocksWithTxsApi" className="flex-none text-right">Indexer Api</label>
            </div>
            {findPostsWith === 'indexer-api' && (
                <div className="flex flex-col ml-5 text-[14px]">
                    <div className="flex flex-row gap-1">
                        <p className="mb-1 w-13 flex-none text-right">Api Url:</p>
                        <input className="flex-1 mb-1 py-0.5 px-1 outline-1 text-[11px] placeholder:text-gray-500" disabled={inputIdenaIndexerApiUrlApplied} value={inputIdenaIndexerApiUrl} onChange={e => setInputIdenaIndexerApiUrl(e.target.value)} />
                    </div>
                    {indexerApiUrlInvalid && <p className="ml-14 text-[11px] text-red-400">Invalid Api Url.</p>}
                    <div className="flex flex-row">
                        <button className={`h-7 w-16 mt-1 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer ${inputIdenaIndexerApiUrlApplied ? 'bg-white/10' : 'bg-white/30'}`} onClick={() => setInputIdenaIndexerApiUrlApplied(!inputIdenaIndexerApiUrlApplied)}>{inputIdenaIndexerApiUrlApplied ? 'Change' : 'Apply'}</button>
                        {!inputIdenaIndexerApiUrlApplied && <p className="w-18 ml-1.5 mt-1 text-gray-400 text-[11px]/3.5">Apply changes to take effect</p>}
                    </div>
                </div>
            )}
        </div>
    </>);
}

export default Settings;
