
function LdsSpinnerComponent() {

    return (<>
        <div className="flex justify-center py-6" role="status" aria-label="Loading">
            <svg className="size-7 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                <path d="M21.5 12A9.5 9.5 0 0 0 12 2.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
        </div>
    </>);
}

export default LdsSpinnerComponent;
