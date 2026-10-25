import type { BrowserStateHistorySettings } from "../App.exports";

type SortPostsByComponentProps = {
    sortPostsBy: string,
    setBrowserStateHistorySettings: (pageDomSetting: Partial<BrowserStateHistorySettings>, rerender?: boolean) => void,
    variant?: 'tabs' | 'pills',
};

const sortOptions = [
    { value: 'latest-posts', label: 'Latest Posts' },
    { value: 'latest-activity', label: 'Latest Activity' },
];

function SortPostsByComponent(props: SortPostsByComponentProps) {

    const {
        sortPostsBy,
        setBrowserStateHistorySettings,
        variant = 'tabs',
    } = props;

    if (variant === 'pills') {
        return (
            <div className="flex flex-row gap-2 px-4 py-3" role="tablist">
                {sortOptions.map(option => {
                    const isActive = sortPostsBy === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            className={`h-8 px-4 rounded-full border text-[14px] font-bold cursor-pointer ${isActive ? 'border-accent bg-accent text-white' : 'border-line-strong text-ink hover:bg-ink/10'}`}
                            onClick={() => setBrowserStateHistorySettings({ sortPostsBy: option.value }, true)}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="flex flex-row" role="tablist">
            {sortOptions.map(option => {
                const isActive = sortPostsBy === option.value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className="flex-1 flex justify-center h-[53px] cursor-pointer hover:bg-ink/10"
                        onClick={() => setBrowserStateHistorySettings({ sortPostsBy: option.value }, true)}
                    >
                        <span className={`relative flex items-center text-[15px] ${isActive ? 'font-bold text-ink' : 'font-medium text-ink-muted'}`}>
                            {option.label}
                            {isActive && <span className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-accent" />}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

export default SortPostsByComponent;
