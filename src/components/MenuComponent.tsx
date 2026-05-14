import { Link } from "react-router";
import settingsWhiteSvg from '../assets/settings-white.svg';
import homeWhiteSvg from '../assets/home-white.svg';
import profileWhiteSvg from '../assets/profile-round-1342-white.svg';

type MenuComponentProps = {
    postersAddress: string,
};

function MenuComponent(props: MenuComponentProps) {

    const {
        postersAddress,
    } = props;

    return (<>
        <hr />
        <Link to="/"><div className="hover:bg-gray-400/30 py-1"><img src={homeWhiteSvg} className="h-7 p-[3px] mr-0.5 inline-block rounded-md" /> <span className="align-middle">HOME</span></div></Link>
        <hr />
        <Link to="/settings"><div className="hover:bg-gray-400/30 py-1"><img src={settingsWhiteSvg} className="h-7 p-[3px] mr-0.5 inline-block rounded-md" /> <span className="align-middle">SETTINGS</span></div></Link>
        <hr />
        <Link to={`/address/${postersAddress}`}><div className="hover:bg-gray-400/30 py-1"><img src={profileWhiteSvg} className="h-7 p-[3px] mr-0.5 inline-block rounded-md" /> <span className="align-middle">PROFILE</span></div></Link>
        <hr />
    </>);
}

export default MenuComponent;
