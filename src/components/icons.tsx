type IconProps = {
    className?: string,
    filled?: boolean,
};

const svgProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
};

const fillWhen = (filled?: boolean) => filled ? 'currentColor' : 'none';

export function HomeIcon({ className, filled }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <path d="M3.75 10.4 12 3.75l8.25 6.65v9.1c0 .55-.45 1-1 1H15v-5.75c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v5.75H4.75c-.55 0-1-.45-1-1z" fill={fillWhen(filled)} />
        </svg>
    );
}

export function ProfileIcon({ className, filled }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <circle cx="12" cy="8" r="4" fill={fillWhen(filled)} />
            <path d="M4.5 20.25c.6-3.6 3.6-5.75 7.5-5.75s6.9 2.15 7.5 5.75z" fill={fillWhen(filled)} />
        </svg>
    );
}

export function MessagesIcon({ className, filled }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <rect x="3" y="5" width="18" height="14" rx="2.5" fill={fillWhen(filled)} />
            <path d="m3.75 7.25 8.25 6 8.25-6" stroke={filled ? 'var(--color-canvas)' : 'currentColor'} />
        </svg>
    );
}

export function BellIcon({ className, filled }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <path d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 1.75h-15z" fill={fillWhen(filled)} />
            <path d="M10 21.25h4" />
        </svg>
    );
}

export function SettingsIcon({ className, filled }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <path d="M10.1 4.9L10.39 2.38L13.61 2.38L13.9 4.9L15.68 5.63L17.66 4.06L19.94 6.34L18.37 8.32L19.1 10.1L21.62 10.39L21.62 13.61L19.1 13.9L18.37 15.68L19.94 17.66L17.66 19.94L15.68 18.37L13.9 19.1L13.61 21.62L10.39 21.62L10.1 19.1L8.33 18.37L6.34 19.94L4.06 17.66L5.63 15.67L4.9 13.9L2.38 13.61L2.38 10.39L4.9 10.1L5.63 8.33L4.06 6.34L6.34 4.06L8.32 5.63z" fill={fillWhen(filled)} />
            <circle cx="12" cy="12" r="3" fill={filled ? 'var(--color-canvas)' : 'none'} />
        </svg>
    );
}

export function ReplyIcon({ className }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <path d="M12 4c4.42 0 8 3.13 8 7s-3.58 7-8 7c-1.13 0-2.2-.2-3.17-.57L4.5 19.5l1.12-3.65A6.6 6.6 0 0 1 4 11c0-3.87 3.58-7 8-7z" />
        </svg>
    );
}

export function HeartIcon({ className, filled }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <path d="M12 20.25c-.3 0-8.75-4.9-8.75-11 0-2.75 2.1-4.75 4.6-4.75 1.75 0 3.25.95 4.15 2.45.9-1.5 2.4-2.45 4.15-2.45 2.5 0 4.6 2 4.6 4.75 0 6.1-8.45 11-8.75 11z" fill={fillWhen(filled)} />
        </svg>
    );
}

export function TipIcon({ className }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <rect x="2.75" y="6" width="18.5" height="12" rx="2" />
            <circle cx="12" cy="12" r="2.75" />
            <path d="M6.25 9.5v.01M17.75 14.5v.01" strokeWidth={2.5} />
        </svg>
    );
}

export function ImageIcon({ className }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <rect x="3.25" y="4.25" width="17.5" height="15.5" rx="2.5" />
            <circle cx="9" cy="9.75" r="1.75" />
            <path d="m20.5 15.5-4.25-4.25L7 19.5" />
        </svg>
    );
}

export function CopyIcon({ className }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <rect x="8.75" y="8.75" width="11.5" height="11.5" rx="2" />
            <path d="M15.25 8.75V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.25a2 2 0 0 0 2 2h2.75" />
        </svg>
    );
}

export function SendIcon({ className }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <path d="M20.5 3.5 3.5 10.25l6.75 3.25 3.25 6.75z" />
            <path d="m20.5 3.5-10.25 10" />
        </svg>
    );
}

export function ComposeIcon({ className }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <path d="M4 20h4.25L19.25 9a2.47 2.47 0 0 0-3.5-3.5L4.75 16.5z" />
            <path d="m14.25 7 3.5 3.5" />
        </svg>
    );
}

export function UserPlusIcon({ className }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <circle cx="10" cy="8" r="3.75" />
            <path d="M3.25 20c.55-3.4 3.3-5.5 6.75-5.5 1.3 0 2.5.3 3.5.85" />
            <path d="M18.5 14v6M15.5 17h6" />
        </svg>
    );
}

export function UsersIcon({ className }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <circle cx="9" cy="8.5" r="3.5" />
            <path d="M2.75 19.5c.5-3.2 3.1-5.25 6.25-5.25s5.75 2.05 6.25 5.25" />
            <path d="M15.5 5.25a3.5 3.5 0 0 1 0 6.5M17.75 14.4c1.9.65 3.2 2.35 3.5 5.1" />
        </svg>
    );
}

export function ArrowLeftIcon({ className }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <path d="M19.5 12h-15M10.75 5.75 4.5 12l6.25 6.25" />
        </svg>
    );
}

export function ArrowUpIcon({ className }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <path d="M12 19.5v-15M5.75 10.75 12 4.5l6.25 6.25" />
        </svg>
    );
}

export function CloseIcon({ className }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <path d="M6 6l12 12M18 6 6 18" />
        </svg>
    );
}

export function CheckIcon({ className }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <path d="m5 12.75 4.25 4.25L19 7.25" />
        </svg>
    );
}

export function ExternalLinkIcon({ className }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <path d="M13.5 4.5h6v6M19.5 4.5l-8.25 8.25M17.5 13.5v4.75c0 .7-.55 1.25-1.25 1.25H5.75c-.7 0-1.25-.55-1.25-1.25V7.75c0-.7.55-1.25 1.25-1.25h4.75" />
        </svg>
    );
}

export function BlockIcon({ className }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <path d="M12 3 19.75 7.5v9L12 21l-7.75-4.5v-9z" />
            <path d="M4.25 7.5 12 12l7.75-4.5M12 12v9" />
        </svg>
    );
}

export function ClockIcon({ className }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <circle cx="12" cy="12" r="8.75" />
            <path d="M12 7.5V12l3 1.75" />
        </svg>
    );
}

export function MoreIcon({ className }: IconProps) {
    return (
        <svg {...svgProps} className={className}>
            <circle cx="5.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="18.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
    );
}
