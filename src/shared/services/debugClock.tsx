export const BOOT_TIME = Date.now();

export const sinceBoot = (): string => `+${Date.now() - BOOT_TIME}ms`;
