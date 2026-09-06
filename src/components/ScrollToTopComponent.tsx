import { useState, useEffect } from 'react';
import topUpSvg from '../assets/top-up-direction-move.svg';
import topUpSvgWhite from '../assets/top-up-direction-move-white.svg';

type ScrollToTopComponentProps = {
    width?: string,
};

function ScrollToTopComponent(props: ScrollToTopComponentProps) {

    const {
        width,
    } = props;

    const [isVisible, setIsVisible] = useState(false);
    const [imgSrc, setImgSrc] = useState(topUpSvg);

    useEffect(() => {
        const toggleVisibility = () => {
            if (window.scrollY > 300) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        window.addEventListener('scroll', toggleVisibility);

        return () => window.removeEventListener('scroll', toggleVisibility);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <img
            src={imgSrc}
            className={`m-2 inline-block hover:cursor-pointer ${width ?? 'w-20'} ${!isVisible ? 'invisible' : ''}`}
            onClick={() => scrollToTop()}
            onMouseEnter={() => setImgSrc(topUpSvgWhite)}
            onMouseLeave={() => setImgSrc(topUpSvg)}
        />
    );
};

export default ScrollToTopComponent;
