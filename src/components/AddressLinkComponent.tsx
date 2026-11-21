import { Link } from 'react-router';
import { useAppContext } from '../AppContext';
import { getDisplayAddressShort } from '../logic/utils';

// An account's short name or address, linking to its profile.
function AddressLinkComponent({ address, className = '' }: { address: string, className?: string }) {
    const { postersRef } = useAppContext();
    return <Link to={`/profile/${address}`} className={`font-bold text-ink hover:underline ${className}`}>{getDisplayAddressShort(address, postersRef.current[address])}</Link>;
}

export default AddressLinkComponent;
