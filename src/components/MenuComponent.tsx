import { Link, useLocation } from "react-router";
import { BellIcon, HomeIcon, MessagesIcon, ProfileIcon, SettingsIcon } from './icons';

type MenuComponentProps = {
    postersAddress: string,
    unreadPostActivities: number,
    unreadMessages: number,
    variant: 'sidebar' | 'bottom',
};

function MenuComponent(props: MenuComponentProps) {

    const {
        postersAddress,
        unreadPostActivities,
        unreadMessages,
        variant,
    } = props;

    const { pathname } = useLocation();

    const profilePath = `/profile/${postersAddress.toLowerCase()}`;

    const menuItems = [
        { to: '/', label: 'Home', Icon: HomeIcon, active: pathname === '/' },
        { to: profilePath, label: 'Profile', Icon: ProfileIcon, active: !!postersAddress && pathname.toLowerCase().startsWith(profilePath.toLowerCase()) },
        { to: '/messages', label: 'Messages', Icon: MessagesIcon, active: pathname === '/messages' || pathname.startsWith('/conversation/'), badgeCount: unreadMessages },
        { to: '/postactivity', label: 'Post Activity', Icon: BellIcon, active: pathname === '/postactivity', badgeCount: unreadPostActivities },
        { to: '/settings', label: 'Settings', Icon: SettingsIcon, active: pathname === '/settings' },
    ];

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    };

    const getAriaLabel = (label: string, badgeCount: number) => badgeCount >= 1 ? `${label} (${badgeCount} unread)` : label;

    const renderBadge = (badgeCount: number) => badgeCount >= 1 && (
        <span aria-hidden="true" className="absolute -top-1.5 left-3.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-canvas bg-btn-hover px-1 text-[11px]/none font-bold text-btn-ink">
            <span className="[text-box:trim-both_cap_alphabetic]">{badgeCount > 99 ? '99+' : badgeCount}</span>
        </span>
    );

    if (variant === 'bottom') {
        return (
            <nav className="flex h-[53px]" aria-label="Primary">
                {menuItems.map(({ to, label, Icon, active, badgeCount = 0 }) => (
                    <Link key={label} to={to} aria-label={getAriaLabel(label, badgeCount)} title={label} aria-current={active ? 'page' : undefined} onClick={scrollToTop} className="flex flex-1 items-center justify-center active:bg-ink/10">
                        <span className="relative">
                            <Icon className="size-[26px]" filled={active} />
                            {renderBadge(badgeCount)}
                        </span>
                    </Link>
                ))}
            </nav>
        );
    }

    return (
        <nav className="-mx-2 flex flex-col xl:-mx-3" aria-label="Primary">
            {menuItems.map(({ to, label, Icon, active, badgeCount = 0 }) => (
                <Link key={label} to={to} aria-label={getAriaLabel(label, badgeCount)} title={label} aria-current={active ? 'page' : undefined} onClick={scrollToTop} className="flex justify-center px-2 py-1 hover:bg-ink/10 xl:justify-start xl:px-3">
                    <span className="inline-flex items-center gap-5 p-3">
                        <span className="relative flex-none">
                            <Icon className="size-[26px]" filled={active} />
                            {renderBadge(badgeCount)}
                        </span>
                        <span className={`hidden pr-4 text-xl/6 xl:inline ${active ? 'font-bold' : ''}`}>{label}</span>
                    </span>
                </Link>
            ))}
        </nav>
    );
}

export default MenuComponent;
