/**
 * The logo as an SVG string, for generated images (share card, Apple touch
 * icon) where React SVG components cannot be used. Keep in step with
 * src/components/brand/Logo.tsx and src/app/icon.svg.
 */
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2BC4AE"/><stop offset="0.5" stop-color="#00877C"/><stop offset="1" stop-color="#004A4B"/></linearGradient></defs><rect width="32" height="32" rx="9.5" fill="url(#bg)"/><rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="none" stroke="#fff" stroke-opacity="0.2"/><circle cx="14.25" cy="18" r="7.4" fill="none" stroke="#fff" stroke-width="3.4"/><path d="M10.7 18.3l2.4 2.4 4.6-4.9" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M23.1 3.4c.5 3.3 2 4.8 5.3 5.3-3.3.5-4.8 2-5.3 5.3-.5-3.3-2-4.8-5.3-5.3 3.3-.5 4.8-2 5.3-5.3z" fill="#F9D04F"/></svg>`;

export const LOGO_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString("base64")}`;
