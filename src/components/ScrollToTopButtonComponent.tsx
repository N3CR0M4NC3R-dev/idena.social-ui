import { useState, useEffect } from 'react';
import { ArrowUpIcon } from './icons';

type ScrollToTopButtonComponentProps = {
    variant?: 'round' | 'fab',
    className?: string,
};

const variantClassNames = {
    round: 'flex size-11 items-center justify-center rounded-full border border-line bg-canvas cursor-pointer hover:bg-ink/10',
    fab: 'btn-accent size-14 opacity-75 hover:opacity-100 shadow-[0_0_15px_color-mix(in_srgb,var(--color-ink)_20%,transparent),0_0_3px_1px_color-mix(in_srgb,var(--color-ink)_15%,transparent)]',
};

function ScrollToTopButtonComponent(props: ScrollToTopButtonComponentProps) {

    const {
        variant = 'round',
        className,
    } = props;

    const [isVisible, setIsVisible] = useState(false);

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
        <button
            id="scrollToTopButton"
            type="button"
            aria-label="Scroll to top"
            title="Scroll to top"
            className={`${variantClassNames[variant]} ${className ?? ''} ${!isVisible ? 'invisible' : ''}`}
            onClick={() => scrollToTop()}
        >
            <ArrowUpIcon className={variant === 'fab' ? 'size-6' : 'size-5'} />
        </button>
    );
};

export default ScrollToTopButtonComponent;
