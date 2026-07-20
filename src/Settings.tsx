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
        handleSetInputCredentialsApplied,
    } = useOutletContext() as SettingsProps;

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
