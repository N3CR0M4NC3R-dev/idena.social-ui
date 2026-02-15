import type { NavigateOptions, To } from "react-router";

export type NavigateWrapper = (to: To, state: any | null, options?: NavigateOptions) => void | Promise<void>;
