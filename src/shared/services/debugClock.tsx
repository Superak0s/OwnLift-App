// Single shared epoch so timing logs scattered across different files/renders
// land on one comparable timeline instead of each resetting its own t0.
export const BOOT_TIME = Date.now();

export const sinceBoot = (): string => `+${Date.now() - BOOT_TIME}ms`;
