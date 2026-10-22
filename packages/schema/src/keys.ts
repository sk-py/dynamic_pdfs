// Whitelists. Everything that came from a stored template and ends up in output goes through these.
export const SAFE_KEY_REGEX = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/;
export const SAFE_HEX_COLOR_REGEX = /^#[0-9a-fA-F]{3,6}$/;
export const SAFE_FONT_SIZE_REGEX = /^(8|9|10|11|12|14|16|18)px$/;
