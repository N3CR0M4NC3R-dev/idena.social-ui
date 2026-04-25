import type { BrowserStateHistorySettings } from "../App.exports";

type SortPostsByComponentProps = {
    sortPostsBy: string,
    setBrowserStateHistorySettings: (pageDomSetting: Partial<BrowserStateHistorySettings>, rerender?: boolean) => void,
};

function SortPostsByComponent(props: SortPostsByComponentProps) {

    const {
        sortPostsBy,
        setBrowserStateHistorySettings,
    } = props;

    return (<>
        <div className="flex flex-row">
            <div className="flex-1 mr-1 text-right text-[12px]">Sort by:</div>
            <div className="w-43 mb-2 flex flex-row items-center">
                <div className={`flex-auto border-1 text-[11px] text-center hover:cursor-pointer hover:bg-white/30 ${sortPostsBy === 'latest-posts' ? 'bg-white/30' : ''}`} onClick={() => setBrowserStateHistorySettings({ sortPostsBy: 'latest-posts' }, true)}>Latest Posts</div>
                <div className={`-ml-[1px] flex-auto border-1 text-[11px] text-center hover:cursor-pointer hover:bg-white/30 ${sortPostsBy === 'latest-activity' ? 'bg-white/30' : ''}`} onClick={() => setBrowserStateHistorySettings({ sortPostsBy: 'latest-activity' }, true)}>Latest Activity</div>
            </div>
        </div>
    </>);
}

export default SortPostsByComponent;
