import { ArrowLeftIcon } from './icons';

type PageHeaderComponentProps = {
    title?: string,
    subtitle?: string,
    onBack?: () => void,
    sticky?: boolean,
    children?: React.ReactNode,
};

function PageHeaderComponent(props: PageHeaderComponentProps) {

    const {
        title,
        subtitle,
        onBack,
        sticky = true,
        children,
    } = props;

    return (
        <div className={`border-b border-line ${sticky ? 'sticky top-[var(--sticky-top,0px)] z-20 bg-canvas/65 backdrop-blur-md' : ''}`}>
            {(title || onBack) && <div className="flex h-[53px] items-center gap-6 px-4">
                {onBack && <button type="button" aria-label="Back" title="Back" className="-ml-2 flex size-9 flex-none cursor-pointer items-center justify-center rounded-full hover:bg-ink/10" onClick={onBack}>
                    <ArrowLeftIcon className="size-5" />
                </button>}
                <div className="min-w-0">
                    <h2 className="truncate text-xl/6 font-extrabold">{title}</h2>
                    {subtitle && <p className="truncate text-[13px]/4 text-ink-muted">{subtitle}</p>}
                </div>
            </div>}
            {children}
        </div>
    );
}

export default PageHeaderComponent;
