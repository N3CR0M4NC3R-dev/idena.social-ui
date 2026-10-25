
type RpcPostMessageUIComponentProps = {
    storeTextIpfs: boolean,
    setStoreTextIpfs: React.Dispatch<React.SetStateAction<boolean>>,
    storeMediaIpfs: boolean,
    setStoreMediaIpfs: React.Dispatch<React.SetStateAction<boolean>>,
    localSubmitHandler: () => void,
    submitText: string,
};

function RpcPostMessageUIComponent(props: RpcPostMessageUIComponentProps) {

    const {
        storeTextIpfs,
        setStoreTextIpfs,
        storeMediaIpfs,
        setStoreMediaIpfs,
        localSubmitHandler,
        submitText,
    } = props;

    const onChangeTextIpfsHandler = () => {
        setStoreTextIpfs(!storeTextIpfs);
    };

    const onChangeMediaIpfsHandler = () => {
        setStoreMediaIpfs(!storeMediaIpfs);
    };

    return (<>
        <div className="text-[15px]/5">
            <div className="flex items-center gap-3 py-3">
                <label htmlFor="textIpfs" className="min-w-0 flex-1 cursor-pointer">Store text on IPFS</label>
                <div className="group grid size-5 flex-none grid-cols-1">
                    <input
                        id="textIpfs"
                        type="checkbox"
                        name="textIpfs"
                        checked={storeTextIpfs}
                        aria-describedby="comments-description"
                        className="col-start-1 row-start-1 cursor-pointer appearance-none rounded border-2 border-line-strong bg-transparent checked:border-accent checked:bg-accent indeterminate:border-accent indeterminate:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:border-line disabled:bg-surface disabled:checked:bg-surface forced-colors:appearance-auto"
                        onChange={onChangeTextIpfsHandler}
                    />
                    <svg viewBox="0 0 14 14" fill="none" className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-ink/25">
                        <path d="M3 8L6 11L11 3.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-has-checked:opacity-100" />
                        <path d="M3 7H11" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-has-indeterminate:opacity-100" />
                    </svg>
                </div>
            </div>
            <div className="flex items-center gap-3 py-3">
                <label htmlFor="mediaIpfs" className="min-w-0 flex-1 cursor-pointer">Store image on IPFS</label>
                <div className="group grid size-5 flex-none grid-cols-1">
                    <input
                        id="mediaIpfs"
                        type="checkbox"
                        name="mediaIpfs"
                        checked={storeMediaIpfs}
                        aria-describedby="comments-description"
                        className="col-start-1 row-start-1 cursor-pointer appearance-none rounded border-2 border-line-strong bg-transparent checked:border-accent checked:bg-accent indeterminate:border-accent indeterminate:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:border-line disabled:bg-surface disabled:checked:bg-surface forced-colors:appearance-auto"
                        onChange={onChangeMediaIpfsHandler}
                    />
                    <svg viewBox="0 0 14 14" fill="none" className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-ink/25">
                        <path d="M3 8L6 11L11 3.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-has-checked:opacity-100" />
                        <path d="M3 7H11" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-has-indeterminate:opacity-100" />
                    </svg>
                </div>
            </div>
            <div className="mt-3 flex justify-end">
                <button type="button" className="btn-primary h-9 px-4 text-[15px]" onClick={() => localSubmitHandler()}>{submitText}</button>
            </div>
        </div>
    </>);
}

export default RpcPostMessageUIComponent;
