import { Link, useLocation } from "react-router";
import { BellIcon, HomeIcon, MessagesIcon, ProfileIcon, SettingsIcon } from './icons';

type MenuComponentProps = {
    postersAddress: string,
    variant: 'sidebar' | 'bottom',
};

function MenuComponent(props: MenuComponentProps) {

    const {
        postersAddress,
        variant,
    } = props;

    const { pathname } = useLocation();

    const profilePath = `/profile/${postersAddress.toLowerCase()}`;

    const menuItems = [
        { to: '/', label: 'Home', Icon: HomeIcon, active: pathname === '/' },
        { to: profilePath, label: 'Profile', Icon: ProfileIcon, active: !!postersAddress && pathname.toLowerCase().startsWith(profilePath.toLowerCase()) },
        { to: '/messages', label: 'Messages', Icon: MessagesIcon, active: pathname === '/messages' || pathname.startsWith('/conversation/') },
        { to: '/postactivity', label: 'Post Activity', Icon: BellIcon, active: pathname === '/postactivity' },
        { to: '/settings', label: 'Settings', Icon: SettingsIcon, active: pathname === '/settings' },
    ];

    if (variant === 'bottom') {
        return (
            <nav className="flex h-[53px]" aria-label="Primary">
                {menuItems.map(({ to, label, Icon, active }) => (
                    <Link key={label} to={to} aria-label={label} title={label} aria-current={active ? 'page' : undefined} className="flex flex-1 items-center justify-center active:bg-ink/10">
                        <Icon className="size-[26px]" filled={active} />
                    </Link>
                ))}
            </nav>
        );
    }

    return (
        <nav className="-mx-2 flex flex-col xl:-mx-3" aria-label="Primary">
            {menuItems.map(({ to, label, Icon, active }) => (
                <Link key={label} to={to} aria-label={label} title={label} aria-current={active ? 'page' : undefined} className="flex justify-center px-2 py-1 hover:bg-ink/10 xl:justify-start xl:px-3">
                    <span className="inline-flex items-center gap-5 p-3">
                        <Icon className="size-[26px] flex-none" filled={active} />
                        <span className={`hidden pr-4 text-xl/6 xl:inline ${active ? 'font-bold' : ''}`}>{label}</span>
                    </span>
                </Link>
            ))}
        </nav>
    );
}

export default MenuComponent;
