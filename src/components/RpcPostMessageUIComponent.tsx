
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
        <div className="text-[14px]">
            <div className="mb-3">
                <div className="flex flex-row gap-2 items-center">
                    <div className="group grid size-4 grid-cols-1">
                        <input
                            id="textIpfs"
                            type="checkbox"
                            name="textIpfs"
                            checked={storeTextIpfs}
                            aria-describedby="comments-description"
                            className="col-start-1 row-start-1 appearance-none rounded-sm border border-white/10 bg-white/5 checked:border-blue-500 checked:bg-blue-500 indeterminate:border-blue-500 indeterminate:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:border-white/5 disabled:bg-white/10 disabled:checked:bg-white/10 forced-colors:appearance-auto"
                            onChange={onChangeTextIpfsHandler}
                        />
                        <svg viewBox="0 0 14 14" fill="none" className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-white/25">
                            <path d="M3 8L6 11L11 3.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="opacity-0 group-has-checked:opacity-100" />
                            <path d="M3 7H11" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="opacity-0 group-has-indeterminate:opacity-100" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <label htmlFor="textIpfs">Store text on IPFS</label>
                    </div>
                </div>
            </div>
            <div className="mb-3">
                <div className="flex flex-row gap-2 items-center">
                    <div className="group grid size-4 grid-cols-1">
                        <input
                            id="mediaIpfs"
                            type="checkbox"
                            name="mediaIpfs"
                            checked={storeMediaIpfs}
                            aria-describedby="comments-description"
                            className="col-start-1 row-start-1 appearance-none rounded-sm border border-white/10 bg-white/5 checked:border-blue-500 checked:bg-blue-500 indeterminate:border-blue-500 indeterminate:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:border-white/5 disabled:bg-white/10 disabled:checked:bg-white/10 forced-colors:appearance-auto"
                            onChange={onChangeMediaIpfsHandler}
                        />
                        <svg viewBox="0 0 14 14" fill="none" className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-white/25">
                            <path d="M3 8L6 11L11 3.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="opacity-0 group-has-checked:opacity-100" />
                            <path d="M3 7H11" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="opacity-0 group-has-indeterminate:opacity-100" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <label htmlFor="mediaIpfs">Store image on IPFS</label>
                    </div>
                </div>
            </div>
            <div className="mb-3">
                <button className="h-7 px-3 text-[13px] bg-white/10 inset-ring inset-ring-white/5 hover:bg-white/20 cursor-pointer" onClick={() => localSubmitHandler()}>{submitText}</button>
            </div>
        </div>
    </>);
}

export default RpcPostMessageUIComponent;
