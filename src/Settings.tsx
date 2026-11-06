import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { defaultSettings } from "./App";
import { clearMessagesCache } from "./logic/messagesStore";
import { clearPostersCache } from "./logic/postersStore";
import { clearPostsCache } from "./logic/postsStore";
import { clearTipsCache } from "./logic/tipsStore";
import { clearIgnoresCache } from "./logic/ignoreStore";
import { clearBlocksCapturedRange } from "./logic/blocksCapturedStore";
import { clearPostActivityCache } from "./logic/postActivityStore";
import { clearMessageReadStatusCache } from "./logic/messageReadStatusStore";
import { type Theme, applyTheme, defaultTheme, getTheme, saveTheme } from "./logic/theme";
import PageHeaderComponent from "./components/PageHeaderComponent";

type SettingsProps = {
    nodeUrl: string,
    setNodeUrl: React.Dispatch<React.SetStateAction<string>>,
    nodeAvailable: boolean,
    nodeKey: string,
    setNodeKey: React.Dispatch<React.SetStateAction<string>>,
    makePostsWith: string,
    handleMakePostsWithToggle: (value: string) => void,
    webAppUrl: string,
    setWebAppUrl: React.Dispatch<React.SetStateAction<string>>,
    viewOnlyNode: boolean,
    postersAddressInvalid: boolean,
    validatePostersAddress: (postersAddress: string) => void,
    findPostsWith: string,
    handleInputFindPostsWithToggle: (value: string) => void,
    indexerApiUrl: string,
    indexerApiUrlInvalid: boolean,
    applyIndexerApiUrl: (indexerApiUrl: string) => void,
    encryptedPrivateKey: string,
    setEncryptedPrivateKey: React.Dispatch<React.SetStateAction<string>>,
    password: string,
    setPassword: React.Dispatch<React.SetStateAction<string>>,
    credentialsInvalid: string,
    validateCredentials: (encryptedPrivateKey?: string, password?: string) => void,
    saveEncryptedKey: boolean,
    setSaveEncryptedKey: React.Dispatch<React.SetStateAction<boolean>>,
    savePassword: boolean,
    setSavePassword: React.Dispatch<React.SetStateAction<boolean>>,
    setMakePostsWith: React.Dispatch<React.SetStateAction<string>>,
    setIndexerApiUrl: React.Dispatch<React.SetStateAction<string>>,
    postersAddress: string,
    zeroAddress: string,
};

const radioClassName = 'col-start-1 row-start-1 cursor-pointer appearance-none rounded-full border-2 border-line-strong bg-transparent checked:bg-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent forced-colors:appearance-auto';

const themeOptions: { value: Theme, label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'Match device' },
];

const normalizeWebAppUrl = (value: string) => {
    try {
        const url = new URL(value.trim());
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
            return null;
        }
        return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
    } catch {
        return null;
    }
};

function RadioCheckMark() {
    return (
        <svg viewBox="0 0 14 14" fill="none" aria-hidden="true" className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-btn-ink opacity-0 group-has-checked:opacity-100">
            <path d="M3 8L6 11L11 3.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function Settings() {
    const navigate = useNavigate();

    const {
        nodeUrl,
        setNodeUrl,
        nodeAvailable,
        nodeKey,
        setNodeKey,
        makePostsWith,
        handleMakePostsWithToggle,
        webAppUrl,
        setWebAppUrl,
        viewOnlyNode,
        postersAddressInvalid,
        validatePostersAddress,
        findPostsWith,
        handleInputFindPostsWithToggle,
        indexerApiUrl,
        indexerApiUrlInvalid,
        applyIndexerApiUrl,
        encryptedPrivateKey,
        setEncryptedPrivateKey,
        password,
        setPassword,
        credentialsInvalid,
        validateCredentials,
        saveEncryptedKey,
        setSaveEncryptedKey,
        savePassword,
        setSavePassword,
        setMakePostsWith,
        setIndexerApiUrl,
        postersAddress,
        zeroAddress,
    } = useOutletContext() as SettingsProps;

    const [theme, setTheme] = useState(getTheme);

    const [inputNodeUrl, setInputNodeUrl] = useState(nodeUrl);
    const [inputNodeKey, setInputNodeKey] = useState(nodeKey);
    const [inputNodeApplied, setInputNodeApplied] = useState(true);
    const [inputWebAppUrl, setInputWebAppUrl] = useState(webAppUrl);
    const [inputWebAppUrlApplied, setInputWebAppUrlApplied] = useState(true);
    const [webAppUrlInvalid, setWebAppUrlInvalid] = useState(false);
    const [inputPostersAddress, setInputPostersAddress] = useState(postersAddress);
    const [inputPostersAddressApplied, setInputPostersAddressApplied] = useState(true);
    const [inputCredentialsApplied, setInputCredentialsApplied] = useState(true);
    const [inputIdenaIndexerApiUrl, setInputIdenaIndexerApiUrl] = useState(indexerApiUrl);
    const [inputIdenaIndexerApiUrlApplied, setInputIdenaIndexerApiUrlApplied] = useState(true);

    const handleThemeChange = (value: Theme) => {
        saveTheme(value);
        setTheme(value);
    };

    const onChangeSaveEncryptedKeyHandler = (newSaveEncryptedKey: boolean) => {
        setSaveEncryptedKey(newSaveEncryptedKey);
        localStorage.setItem('saveEncryptedKey', `${newSaveEncryptedKey}`);
        localStorage.setItem('encryptedPrivateKey', newSaveEncryptedKey ? encryptedPrivateKey : '');
    };

    const onChangeSavePasswordHandler = (newSavePassword: boolean) => {
        setSavePassword(newSavePassword);
        localStorage.setItem('savePassword', `${newSavePassword}`);
        localStorage.setItem('password', newSavePassword ? password : '');
    };

    useEffect(() => {
        validateCredentials();
    }, []);

    const setInputNodeAppliedLocal = (value: boolean) => {
        setInputNodeApplied(value);
        if (value && (inputNodeUrl !== nodeUrl || inputNodeKey !== nodeKey)) {
            localStorage.setItem('nodeUrl', inputNodeUrl);
            localStorage.setItem('nodeKey', inputNodeKey);
            clearBlocksCapturedRange().then(() => navigate(0));
        }
    };

    const handleMakePostsWithToggleLocal = (value: string) => {
        handleMakePostsWithToggle(value);
        if (value === 'idena-app') {
            setInputPostersAddress(postersAddress || zeroAddress);
        }
    };

    const setInputWebAppUrlAppliedLocal = (value: boolean) => {
        if (!value) {
            setInputWebAppUrlApplied(false);
            return;
        }

        const normalizedWebAppUrl = normalizeWebAppUrl(inputWebAppUrl);

        if (!normalizedWebAppUrl) {
            setWebAppUrlInvalid(true);
            return;
        }

        setWebAppUrlInvalid(false);
        setInputWebAppUrl(normalizedWebAppUrl);
        setWebAppUrl(normalizedWebAppUrl);
        localStorage.setItem('webAppUrl', normalizedWebAppUrl);
        setInputWebAppUrlApplied(true);
    };

    const setInputPostersAddressAppliedLocal = (value: boolean) => {
        setInputPostersAddressApplied(value);

        if (value) {
            const postersAddressChanged = inputPostersAddress !== postersAddress;

            validatePostersAddress(inputPostersAddress);

            if (!postersAddressChanged) {
                return;
            }

            onChangeSaveEncryptedKeyHandler(false);
            onChangeSavePasswordHandler(false);
            clearBlocksCapturedRange().then(() => navigate(0));
        }
    };

    const setInputCredentialsAppliedLocal = (value: boolean) => {
        setInputCredentialsApplied(value);
        if (value) {
            validateCredentials();
        }
    };

    const setInputIdenaIndexerApiUrlAppliedLocal = (value: boolean) => {
        setInputIdenaIndexerApiUrlApplied(value);
        if (value) {
            applyIndexerApiUrl(inputIdenaIndexerApiUrl);
        }
    };

    const handleRestoreDefaultSettings = () => {
        const userConfirmed = confirm('Are you sure you want to restore default settings?');

        if (userConfirmed) {
            setNodeUrl(defaultSettings.nodeUrl);
            setNodeKey(defaultSettings.nodeKey);
            setInputNodeUrl(defaultSettings.nodeUrl);
            setInputNodeKey(defaultSettings.nodeKey);
            setInputNodeApplied(true);

            setMakePostsWith(defaultSettings.makePostsWith);
            setWebAppUrl(defaultSettings.webAppUrl);
            setInputWebAppUrl(defaultSettings.webAppUrl);
            setWebAppUrlInvalid(false);
            setInputWebAppUrlApplied(true);
            setInputPostersAddress(defaultSettings.postersAddress);
            setInputPostersAddressApplied(true);
            validatePostersAddress(defaultSettings.postersAddress);

            setEncryptedPrivateKey(defaultSettings.encryptedPrivateKey);
            setPassword(defaultSettings.password);
            setInputCredentialsApplied(true);
            validateCredentials(defaultSettings.encryptedPrivateKey, defaultSettings.password);

            onChangeSaveEncryptedKeyHandler(defaultSettings.saveEncryptedKey);
            onChangeSavePasswordHandler(defaultSettings.savePassword);

            if (findPostsWith === 'indexer-api') {
                applyIndexerApiUrl(defaultSettings.indexerApiUrl);
            } else {
                setIndexerApiUrl(defaultSettings.indexerApiUrl);
            }
            setInputIdenaIndexerApiUrl(defaultSettings.indexerApiUrl);
            setInputIdenaIndexerApiUrlApplied(true);

            localStorage.clear();

            applyTheme(defaultTheme);
            setTheme(defaultTheme);
        }
    };

    const handleClearCachedContent = () => {
        const userConfirmed = confirm('Are you sure you want to clear the cached content?');

        if (userConfirmed) {
            clearMessagesCache();
            clearPostersCache();
            clearPostsCache();
            clearTipsCache();
            clearIgnoresCache();
            clearPostActivityCache();
            clearMessageReadStatusCache();
            clearBlocksCapturedRange();
        }
    };

    return (<>
        <PageHeaderComponent title="Settings" />
        <section className="flex flex-col gap-3 border-b border-line px-4 py-4">
            <h3 className="text-[17px]/6 font-extrabold">Node</h3>
            <label className="flex flex-col gap-1">
                <span className="text-[13px] text-ink-muted">RPC URL</span>
                <input className="form-field text-[15px]" disabled={inputNodeApplied} value={inputNodeUrl} onChange={e => setInputNodeUrl(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
                <span className="text-[13px] text-ink-muted">API key</span>
                <input className="form-field text-[15px]" disabled={inputNodeApplied} value={inputNodeKey} onChange={e => setInputNodeKey(e.target.value)} />
            </label>
            {!nodeAvailable && <p className="text-[13px] text-danger">Node Unavailable. Please try again.</p>}
            <div className="flex flex-row items-center gap-3">
                <button type="button" className={`${inputNodeApplied ? 'btn-outline' : 'btn-primary'} h-9 px-4 text-[15px]`} onClick={() => setInputNodeAppliedLocal(!inputNodeApplied)}>{inputNodeApplied ? 'Change' : 'Apply'}</button>
                {!inputNodeApplied && <p className="text-[13px] text-ink-muted">Apply changes to take effect</p>}
            </div>
        </section>
        <section className="flex flex-col gap-3 border-b border-line px-4 py-4">
            <h3 className="text-[17px]/6 font-extrabold">Make posts with</h3>
            <div className="flex flex-col gap-1">
                <div className="flex flex-row items-center gap-3 py-1">
                    <div className="group grid size-5 flex-none grid-cols-1">
                        <input id="useRpc" type="radio" name="useRpc" value="rpc" checked={makePostsWith === 'rpc'} onChange={(e) => handleMakePostsWithToggleLocal(e.target.value)} className={radioClassName} />
                        <RadioCheckMark />
                    </div>
                    <label htmlFor="useRpc" className="cursor-pointer text-[15px]/5">RPC</label>
                </div>
                {makePostsWith === 'rpc' && viewOnlyNode && <p className="pl-8 text-[13px] text-danger">Your RPC is View-Only. Switch to: Idena Web App for making posts. (Posting, liking, tipping is disabled)</p>}
                <div className="flex flex-row items-start gap-3 py-1">
                    <div className="group grid size-5 flex-none grid-cols-1">
                        <input id="notUseRpc" type="radio" name="useRpc" value="idena-app" checked={makePostsWith === 'idena-app'} onChange={(e) => handleMakePostsWithToggleLocal(e.target.value)} className={radioClassName} />
                        <RadioCheckMark />
                    </div>
                    <label htmlFor="notUseRpc" className="flex cursor-pointer flex-col text-[15px]/5">
                        <span>Idena Web App</span>
                        <span className="text-[13px] text-ink-muted">No account? Get one at <a className="text-link hover:underline" href="https://app.idena.io" target="_blank">app.idena.io</a></span>
                    </label>
                </div>
            </div>
            {makePostsWith === 'idena-app' && (
                <div className="flex flex-col gap-6 sm:pl-8">
                    <div className="flex flex-col gap-3">
                        <label className="flex flex-col gap-1">
                            <span className="text-[13px] text-ink-muted">Web App URL</span>
                            <input className="form-field text-[15px]" disabled={inputWebAppUrlApplied} value={inputWebAppUrl} onChange={e => setInputWebAppUrl(e.target.value)} />
                        </label>
                        {webAppUrlInvalid && <p className="text-[13px] text-danger">Invalid URL. It must start with https:// or http://</p>}
                        <div className="flex flex-row items-center gap-3">
                            <button type="button" className={`${inputWebAppUrlApplied ? 'btn-outline' : 'btn-primary'} h-9 px-4 text-[15px]`} onClick={() => setInputWebAppUrlAppliedLocal(!inputWebAppUrlApplied)}>{inputWebAppUrlApplied ? 'Change' : 'Apply'}</button>
                            {!inputWebAppUrlApplied && <p className="text-[13px] text-ink-muted">Apply changes to take effect</p>}
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        <label className="flex flex-col gap-1">
                            <span className="text-[13px] text-ink-muted">Your Idena address</span>
                            <input className="form-field text-[12px] sm:text-[15px]" disabled={inputPostersAddressApplied} value={inputPostersAddress} onChange={e => setInputPostersAddress(e.target.value)} />
                        </label>
                        {postersAddressInvalid && <p className="text-[13px] text-danger">Invalid address. (Posting, liking, tipping is disabled).</p>}
                        <div className="flex flex-row items-center gap-3">
                            <button type="button" className={`${inputPostersAddressApplied ? 'btn-outline' : 'btn-primary'} h-9 px-4 text-[15px]`} onClick={() => setInputPostersAddressAppliedLocal(!inputPostersAddressApplied)}>{inputPostersAddressApplied ? 'Change' : 'Apply'}</button>
                            {!inputPostersAddressApplied && <p className="text-[13px] text-ink-muted">Apply changes to take effect</p>}
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        <label className="flex flex-col gap-1">
                            <span className="text-[13px] text-ink-muted">Encrypted private key (Optional, but required for messaging functionality)</span>
                            <input className="form-field text-[15px]" disabled={inputCredentialsApplied} value={encryptedPrivateKey} onChange={e => setEncryptedPrivateKey(e.target.value)} />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-[13px] text-ink-muted">Password</span>
                            <input type="password" className="form-field text-[15px]" disabled={inputCredentialsApplied} value={password} onChange={e => setPassword(e.target.value)} />
                        </label>
                        <div className="flex flex-row items-center gap-3">
                            <button type="button" className={`${inputCredentialsApplied ? 'btn-outline' : 'btn-primary'} h-9 px-4 text-[15px]`} onClick={() => setInputCredentialsAppliedLocal(!inputCredentialsApplied)}>{inputCredentialsApplied ? 'Change' : 'Apply'}</button>
                            {!inputCredentialsApplied && <p className="text-[13px] text-ink-muted">Apply changes to take effect</p>}
                        </div>
                        {credentialsInvalid && inputCredentialsApplied && <p className="text-[13px] text-danger">Invalid credentials: {credentialsInvalid}. (Messaging is disabled)</p>}
                        <div className="flex flex-col gap-1">
                            <div className="flex flex-row items-center gap-3 py-1">
                                <div className="group grid size-5 flex-none grid-cols-1">
                                    <input
                                        id="saveEncryptedKey"
                                        type="checkbox"
                                        name="saveEncryptedKey"
                                        checked={saveEncryptedKey}
                                        aria-describedby="comments-description"
                                        className="col-start-1 row-start-1 cursor-pointer appearance-none rounded border-2 border-line-strong bg-transparent checked:bg-btn indeterminate:bg-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:border-line disabled:bg-surface disabled:checked:bg-surface forced-colors:appearance-auto"
                                        onChange={() => onChangeSaveEncryptedKeyHandler(!saveEncryptedKey)}
                                    />
                                    <svg viewBox="0 0 14 14" fill="none" className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-btn-ink group-has-disabled:stroke-ink/25">
                                        <path d="M3 8L6 11L11 3.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-has-checked:opacity-100" />
                                        <path d="M3 7H11" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-has-indeterminate:opacity-100" />
                                    </svg>
                                </div>
                                <label htmlFor="saveEncryptedKey" className="flex-1 cursor-pointer text-[15px]/5">Save the encrypted key in browser localStorage</label>
                            </div>
                            <div className="flex flex-row items-center gap-3 py-1">
                                <div className="group grid size-5 flex-none grid-cols-1">
                                    <input
                                        id="savePassword"
                                        type="checkbox"
                                        name="savePassword"
                                        checked={savePassword}
                                        aria-describedby="comments-description"
                                        className="col-start-1 row-start-1 cursor-pointer appearance-none rounded border-2 border-line-strong bg-transparent checked:bg-btn indeterminate:bg-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:border-line disabled:bg-surface disabled:checked:bg-surface forced-colors:appearance-auto"
                                        onChange={() => onChangeSavePasswordHandler(!savePassword)}
                                    />
                                    <svg viewBox="0 0 14 14" fill="none" className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-btn-ink group-has-disabled:stroke-ink/25">
                                        <path d="M3 8L6 11L11 3.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-has-checked:opacity-100" />
                                        <path d="M3 7H11" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-has-indeterminate:opacity-100" />
                                    </svg>
                                </div>
                                <label htmlFor="savePassword" className="flex-1 cursor-pointer text-[15px]/5">Save the password in browser localStorage</label>
                            </div>
                            <p className="pl-8 text-[13px] text-ink-muted">(Note: There is a heightened risk when saving both the encrypted key and password. Only do this with accounts possessing small amounts of idna.)</p>
                        </div>
                    </div>
                </div>
            )}
        </section>
        <section className="flex flex-col gap-3 border-b border-line px-4 py-4">
            <h3 className="text-[17px]/6 font-extrabold">Find posts with</h3>
            <div className="flex flex-col gap-1">
                <div className="flex flex-row items-center gap-3 py-1">
                    <div className="group grid size-5 flex-none grid-cols-1">
                        <input id="findPostsWith" type="radio" name="findPostsWith" value="rpc" checked={findPostsWith === 'rpc'} onChange={(e) => handleInputFindPostsWithToggle(e.target.value)} className={radioClassName} />
                        <RadioCheckMark />
                    </div>
                    <label htmlFor="findPostsWith" className="cursor-pointer text-[15px]/5">RPC</label>
                </div>
                <div className="flex flex-row items-center gap-3 py-1">
                    <div className="group grid size-5 flex-none grid-cols-1">
                        <input id="notUseFindPastBlocksWithTxsApi" type="radio" name="findPostsWith" value="indexer-api" checked={findPostsWith === 'indexer-api'} onChange={(e) => handleInputFindPostsWithToggle(e.target.value)} className={radioClassName} />
                        <RadioCheckMark />
                    </div>
                    <label htmlFor="notUseFindPastBlocksWithTxsApi" className="cursor-pointer text-[15px]/5">Indexer API</label>
                </div>
            </div>
            {findPostsWith === 'indexer-api' && (
                <div className="flex flex-col gap-3 sm:pl-8">
                    <label className="flex flex-col gap-1">
                        <span className="text-[13px] text-ink-muted">API URL</span>
                        <input className="form-field text-[15px]" disabled={inputIdenaIndexerApiUrlApplied} value={inputIdenaIndexerApiUrl} onChange={e => setInputIdenaIndexerApiUrl(e.target.value)} />
                    </label>
                    {indexerApiUrlInvalid && <p className="text-[13px] text-danger">Invalid Api Url.</p>}
                    <div className="flex flex-row items-center gap-3">
                        <button type="button" className={`${inputIdenaIndexerApiUrlApplied ? 'btn-outline' : 'btn-primary'} h-9 px-4 text-[15px]`} onClick={() => setInputIdenaIndexerApiUrlAppliedLocal(!inputIdenaIndexerApiUrlApplied)}>{inputIdenaIndexerApiUrlApplied ? 'Change' : 'Apply'}</button>
                        {!inputIdenaIndexerApiUrlApplied && <p className="text-[13px] text-ink-muted">Apply changes to take effect</p>}
                    </div>
                </div>
            )}
        </section>
        <section className="flex flex-col gap-3 border-b border-line px-4 py-4">
            <h3 className="text-[17px]/6 font-extrabold">Appearance</h3>
            <div className="flex flex-col gap-1">
                {themeOptions.map(({ value, label }) => (
                    <div key={value} className="flex flex-row items-center gap-3 py-1">
                        <div className="group grid size-5 flex-none grid-cols-1">
                            <input id={`theme-${value}`} type="radio" name="theme" value={value} checked={theme === value} onChange={() => handleThemeChange(value)} className={radioClassName} />
                            <RadioCheckMark />
                        </div>
                        <label htmlFor={`theme-${value}`} className="cursor-pointer text-[15px]/5">{label}</label>
                    </div>
                ))}
            </div>
        </section>
        <section className="flex flex-wrap gap-3 border-b border-line px-4 py-4">
            <button type="button" className="btn-outline h-9 px-4 text-[15px]" onClick={() => handleRestoreDefaultSettings()}>Restore Default Settings</button>
            <button type="button" className="btn-outline h-9 px-4 text-[15px] border-danger text-danger" onClick={() => handleClearCachedContent()}>Clear Cached Content</button>
        </section>
    </>);
}

export default Settings;
